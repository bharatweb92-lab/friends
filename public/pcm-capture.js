/* Capture mono PCM at 16 kHz. Runs on the browser audio thread, not the UI thread. */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(1024);
    this.index = 0;
    this.position = 0;
    this.active = true;
    this.port.onmessage = (event) => {
      this.active = event.data !== false;
    };
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || !this.active) return true;
    const ratio = sampleRate / 16000;
    while (this.position < input.length) {
      const left = Math.floor(this.position);
      const right = Math.min(left + 1, input.length - 1);
      const fraction = this.position - left;
      const sample = input[left] * (1 - fraction) + input[right] * fraction;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.buffer[this.index++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.index === this.buffer.length) {
        const output = this.buffer.slice();
        this.port.postMessage(output.buffer, [output.buffer]);
        this.index = 0;
      }
      this.position += ratio;
    }
    this.position -= input.length;
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
