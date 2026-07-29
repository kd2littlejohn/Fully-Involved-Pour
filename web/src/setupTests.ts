import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement <dialog>'s imperative API (showModal/close) —
// real browsers do (verified in the browser preview). Minimal polyfill so
// component tests can exercise Modal without touching component code.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
