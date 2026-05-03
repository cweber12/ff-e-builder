import '@testing-library/jest-dom';

// jsdom does not implement URL.createObjectURL / revokeObjectURL
globalThis.URL.createObjectURL = () => 'blob:test-url';
globalThis.URL.revokeObjectURL = () => {};

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  },
});

Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  },
});
