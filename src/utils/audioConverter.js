/**
 * Audio format conversion utilities
 * Twilio uses mulaw 8kHz, ElevenLabs uses PCM16 16kHz
 */

// Mulaw decoding table
const MULAW_DECODE_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mu = ~i & 0xFF;
  let sign = mu & 0x80;
  let exponent = (mu >> 4) & 0x07;
  let mantissa = mu & 0x0F;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  MULAW_DECODE_TABLE[i] = sign ? -sample : sample;
}

// Mulaw encoding - PCM16 to mulaw
function pcm16ToMulaw(sample) {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;

  let sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  sample += MULAW_BIAS;
  if (sample > MULAW_MAX) sample = MULAW_MAX;

  let exponent = 7;
  let mantissa;
  for (let expMask = 0x4000; exponent > 0; exponent--, expMask >>= 1) {
    if (sample & expMask) break;
  }
  mantissa = (sample >> (exponent + 3)) & 0x0F;
  return ~(sign | (exponent << 4) | mantissa) & 0xFF;
}

/**
 * Convert mulaw buffer to PCM16 buffer
 * @param {Buffer} mulawBuffer - Input mulaw audio
 * @returns {Buffer} - PCM16 audio
 */
function mulawToPcm16(mulawBuffer) {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawBuffer[i]];
    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
}

/**
 * Convert PCM16 buffer to mulaw buffer
 * @param {Buffer} pcmBuffer - Input PCM16 audio
 * @returns {Buffer} - Mulaw audio
 */
function pcm16ToMulawBuffer(pcmBuffer) {
  const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulawBuffer[i] = pcm16ToMulaw(sample);
  }

  return mulawBuffer;
}

/**
 * Resample audio from one sample rate to another using linear interpolation
 * @param {Buffer} input - Input PCM16 buffer
 * @param {number} fromRate - Source sample rate
 * @param {number} toRate - Target sample rate
 * @returns {Buffer} - Resampled PCM16 buffer
 */
function resample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;

  const ratio = fromRate / toRate;
  const inputSamples = input.length / 2;
  const outputSamples = Math.floor(inputSamples / ratio);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
    const fraction = srcIndex - srcIndexFloor;

    const sample1 = input.readInt16LE(srcIndexFloor * 2);
    const sample2 = input.readInt16LE(srcIndexCeil * 2);
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);

    output.writeInt16LE(interpolated, i * 2);
  }

  return output;
}

/**
 * Convert Twilio mulaw 8kHz to ElevenLabs PCM16 16kHz
 * @param {Buffer} mulawBuffer - Twilio audio (mulaw 8kHz)
 * @returns {Buffer} - ElevenLabs audio (PCM16 16kHz)
 */
function twilioToElevenLabs(mulawBuffer) {
  // Decode mulaw to PCM16
  const pcm8k = mulawToPcm16(mulawBuffer);
  // Upsample from 8kHz to 16kHz
  const pcm16k = resample(pcm8k, 8000, 16000);
  return pcm16k;
}

/**
 * Convert ElevenLabs PCM16 16kHz to Twilio mulaw 8kHz
 * @param {Buffer} pcmBuffer - ElevenLabs audio (PCM16 16kHz)
 * @returns {Buffer} - Twilio audio (mulaw 8kHz)
 */
function elevenLabsToTwilio(pcmBuffer) {
  // Downsample from 16kHz to 8kHz
  const pcm8k = resample(pcmBuffer, 16000, 8000);
  // Encode to mulaw
  const mulaw = pcm16ToMulawBuffer(pcm8k);
  return mulaw;
}

module.exports = {
  mulawToPcm16,
  pcm16ToMulawBuffer,
  resample,
  twilioToElevenLabs,
  elevenLabsToTwilio,
};
