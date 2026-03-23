import Accelerate
import AVFoundation
import Foundation

// MARK: - AudioLevel

public struct AudioLevel: Sendable {
    /// Linear-scale RMS value.
    public let average: Float
    public let peak: Float
}

// MARK: - AVAudioPCMBuffer extensions

public extension AVAudioPCMBuffer {

    /// Compute peak and linear-scale RMS for all channels.
    func audioLevels() -> [AudioLevel] {
        var result: [AudioLevel] = []
        guard let data = floatChannelData else { return result }

        for i in 0 ..< Int(format.channelCount) {
            let channelData = data[i]
            var peak: Float = 0.0
            vDSP_maxv(channelData, 1, &peak, vDSP_Length(frameLength))
            var rms: Float = 0.0
            vDSP_rmsqv(channelData, 1, &rms, vDSP_Length(frameLength))
            result.append(AudioLevel(average: rms, peak: peak))
        }
        return result
    }

    /// Resample to `targetSampleRate`. Returns self if already at target.
    func resample(toSampleRate targetSampleRate: Double) -> AVAudioPCMBuffer? {
        guard format.sampleRate != targetSampleRate else { return self }

        guard let targetFormat = AVAudioFormat(
            commonFormat: format.commonFormat,
            sampleRate: targetSampleRate,
            channels: format.channelCount,
            interleaved: format.isInterleaved
        ) else { return nil }

        guard let converter = AVAudioConverter(from: format, to: targetFormat) else { return nil }

        let capacity = targetFormat.sampleRate * Double(frameLength) / format.sampleRate
        guard let converted = AVAudioPCMBuffer(
            pcmFormat: targetFormat,
            frameCapacity: AVAudioFrameCount(capacity)
        ) else { return nil }

        var isDone = false
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            if isDone { outStatus.pointee = .noDataNow; return nil }
            outStatus.pointee = .haveData
            isDone = true
            return self
        }

        var error: NSError?
        let status = converter.convert(to: converted, error: &error, withInputFrom: inputBlock)
        guard status != .error else { return nil }
        converted.frameLength = converted.frameCapacity
        return converted
    }

    /// Convert Int16 → Float32 (normalised to [-1.0, 1.0]).
    func convert(toCommonFormat commonFormat: AVAudioCommonFormat) -> AVAudioPCMBuffer? {
        guard format.commonFormat != commonFormat else { return self }
        guard format.commonFormat == .pcmFormatInt16, commonFormat == .pcmFormatFloat32 else {
            return nil
        }

        guard let outputFormat = AVAudioFormat(
            commonFormat: commonFormat,
            sampleRate: format.sampleRate,
            channels: format.channelCount,
            interleaved: false
        ) else { return nil }

        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCapacity) else {
            return nil
        }
        outputBuffer.frameLength = frameLength

        guard let int16Data = int16ChannelData, let floatData = outputBuffer.floatChannelData else {
            return nil
        }

        let scale = Float(Int16.max)
        var scalar = 1.0 / scale

        for channel in 0 ..< Int(format.channelCount) {
            vDSP_vflt16(int16Data[channel], 1, floatData[channel], 1, vDSP_Length(frameLength))
            vDSP_vsmul(floatData[channel], 1, &scalar, floatData[channel], 1, vDSP_Length(frameLength))
        }
        return outputBuffer
    }
}

// MARK: - AudioLevel sequence helpers

public extension Sequence where Element == AudioLevel {
    /// Average all elements into a single AudioLevel.
    func combine() -> AudioLevel? {
        var count = 0
        let sums = reduce((avgSum: Float(0), peakSum: Float(0))) { totals, level in
            count += 1
            return (totals.avgSum + level.average, totals.peakSum + level.peak)
        }
        guard count > 0 else { return nil }
        return AudioLevel(
            average: sums.avgSum / Float(count),
            peak: sums.peakSum / Float(count)
        )
    }
}

// MARK: - RingBuffer

/// Simple non-thread-safe ring buffer for audio sample accumulation.
final class RingBuffer<T: Numeric> {

    private var buffer: [T]
    private var head: Int = 0
    private var isFull = false

    init(size: Int) {
        buffer = [T](repeating: 0, count: size)
    }

    func write(_ value: T) {
        buffer[head] = value
        head = (head + 1) % buffer.count
        if head == 0 { isFull = true }
    }

    func write(_ sequence: [T]) {
        for value in sequence { write(value) }
    }

    func read() -> [T]? {
        guard isFull else { return nil }
        if head == 0 { return buffer }
        return Array(buffer[head...] + buffer[..<head])
    }
}

// MARK: - FFTResult

public struct FFTComputeBandsResult {
    public let count: Int
    public let magnitudes: [Float]
    public let frequencies: [Float]
}

public final class FFTResult {
    public let magnitudes: [Float]

    init(magnitudes: [Float]) {
        self.magnitudes = magnitudes
    }

    func computeBands(
        minFrequency: Float,
        maxFrequency: Float,
        bandsCount: Int,
        sampleRate: Float
    ) -> FFTComputeBandsResult {
        let nyquist = sampleRate / 2.0
        let actualMax = min(nyquist, maxFrequency)
        var bandMagnitudes = [Float](repeating: 0.0, count: bandsCount)
        var bandFrequencies = [Float](repeating: 0.0, count: bandsCount)

        let loIndex = magnitudeIndex(for: minFrequency, sampleRate: sampleRate)
        let hiIndex = magnitudeIndex(for: actualMax,    sampleRate: sampleRate)
        let ratio = Float(hiIndex - loIndex) / Float(bandsCount)

        return magnitudes.withUnsafeBufferPointer { ptr in
            for i in 0 ..< bandsCount {
                let start = vDSP_Length(floorf(Float(i) * ratio)) + loIndex
                let end   = vDSP_Length(floorf(Float(i + 1) * ratio)) + loIndex
                let count = end - start

                if count > 0 {
                    var sum: Float = 0
                    vDSP_sve(ptr.baseAddress! + Int(start), 1, &sum, count)
                    bandMagnitudes[i] = sum / Float(count)
                } else {
                    bandMagnitudes[i] = magnitudes[Int(start)]
                }

                let bw = nyquist / Float(magnitudes.count)
                bandFrequencies[i] = (bw * Float(start) + bw * Float(end)) / 2
            }
            return FFTComputeBandsResult(
                count: bandsCount,
                magnitudes: bandMagnitudes,
                frequencies: bandFrequencies
            )
        }
    }

    private func magnitudeIndex(for freq: Float, sampleRate: Float) -> vDSP_Length {
        vDSP_Length(Float(magnitudes.count) * freq / (sampleRate / 2.0))
    }
}

// MARK: - FFTProcessor

final class FFTProcessor {

    enum WindowType { case none, hanning, hamming }

    let bufferSize: vDSP_Length
    private let halfSize: vDSP_Length
    private let log2Size: vDSP_Length
    private var window: [Float]
    private let fftSetup: FFTSetup
    private var realBuf: [Float]
    private var imagBuf: [Float]
    private var zeroDB: Float = 1.0

    init(bufferSize: Int, windowType: WindowType = .hanning) {
        self.bufferSize = vDSP_Length(bufferSize)
        halfSize = vDSP_Length(bufferSize / 2)
        log2Size = vDSP_Length(log2f(Float(bufferSize)))

        realBuf = [Float](repeating: 0, count: Int(halfSize))
        imagBuf = [Float](repeating: 0, count: Int(halfSize))
        window  = [Float](repeating: 1, count: bufferSize)

        fftSetup = vDSP_create_fftsetup(UInt(log2Size), FFTRadix(FFT_RADIX2))!

        switch windowType {
        case .none: break
        case .hanning: vDSP_hann_window(&window, vDSP_Length(bufferSize), Int32(vDSP_HANN_NORM))
        case .hamming: vDSP_hamm_window(&window, vDSP_Length(bufferSize), 0)
        }
    }

    deinit { vDSP_destroy_fftsetup(fftSetup) }

    func process(buffer: [Float]) -> FFTResult {
        precondition(buffer.count == Int(bufferSize))

        var windowed = [Float](repeating: 0, count: Int(bufferSize))
        vDSP_vmul(buffer, 1, window, 1, &windowed, 1, bufferSize)

        return realBuf.withUnsafeMutableBufferPointer { realPtr in
            imagBuf.withUnsafeMutableBufferPointer { imagPtr in
                var complex = DSPSplitComplex(
                    realp: realPtr.baseAddress!,
                    imagp: imagPtr.baseAddress!
                )
                windowed.withUnsafeBufferPointer { winPtr in
                    let raw = UnsafeRawPointer(winPtr.baseAddress!)
                        .bindMemory(to: DSPComplex.self, capacity: Int(halfSize))
                    vDSP_ctoz(raw, 2, &complex, 1, halfSize)
                }
                vDSP_fft_zrip(fftSetup, &complex, 1, log2Size, FFTDirection(FFT_FORWARD))

                var magnitudes = [Float](repeating: 0, count: Int(halfSize))
                vDSP_zvabs(&complex, 1, &magnitudes, 1, halfSize)
                vDSP_vdbcon(magnitudes, 1, &zeroDB, &magnitudes, 1, vDSP_Length(magnitudes.count), 1)

                return FFTResult(magnitudes: magnitudes)
            }
        }
    }
}

// MARK: - AudioVisualizeProcessor

public final class AudioVisualizeProcessor {

    static let bufferSize = 1024

    public let minFrequency: Float
    public let maxFrequency: Float
    public let minDB: Float
    public let maxDB: Float
    public let bandsCount: Int

    private let ring = RingBuffer<Float>(size: bufferSize)
    private let fft: FFTProcessor

    public init(
        minFrequency: Float = 10,
        maxFrequency: Float = 8000,
        minDB: Float = -32,
        maxDB: Float = 32,
        bandsCount: Int = 100
    ) {
        self.minFrequency = minFrequency
        self.maxFrequency = maxFrequency
        self.minDB        = minDB
        self.maxDB        = maxDB
        self.bandsCount   = bandsCount
        fft = FFTProcessor(bufferSize: Self.bufferSize)
    }

    public func process(pcmBuffer: AVAudioPCMBuffer) -> [Float]? {
        guard let converted = pcmBuffer.convert(toCommonFormat: .pcmFormatFloat32),
              let floatData = converted.floatChannelData
        else { return nil }

        let samples = Array(
            UnsafeBufferPointer(start: floatData[0], count: Int(converted.frameLength))
        )
        ring.write(samples)

        guard let full = ring.read() else { return nil }

        let result = fft.process(buffer: full)
        let bands = result.computeBands(
            minFrequency: minFrequency,
            maxFrequency: maxFrequency,
            bandsCount: bandsCount,
            sampleRate: Float(converted.format.sampleRate)
        )

        let headroom = maxDB - minDB
        return bands.magnitudes.map { mag in
            let adj = max(0, mag + abs(minDB))
            return min(1.0, adj / headroom)
        }
    }
}
