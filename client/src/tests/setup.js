// Global test setup — runs before every test file
//
// IMPORTANT: No static `import` statements in this file.
// In vitest 4.x + Node.js 22, static imports in setupFiles are transformed by
// vite:import-analysis to `await import(...)` calls and executed inside a VM
// context where the importModuleDynamically callback is not set up, causing
// ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING for npm packages.
// All matchers and utilities are wired up via beforeAll() or globals instead.

// Silence React 18 act() warnings in test output
global.IS_REACT_ACT_ENVIRONMENT = true;

// Stub browser APIs not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Stub IntersectionObserver — jsdom lacks it; framer-motion `whileInView`
// (used by the About page sections + Reveal) calls it on mount and crashes otherwise.
global.IntersectionObserver = class {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};
window.IntersectionObserver = global.IntersectionObserver;

// Only stub clipboard — do NOT replace navigator entirely.
// ReactDOM reads navigator.userAgent.indexOf() internally; wiping navigator crashes all suites.
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});

// Mock react-hot-toast globally
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

// Extend expect with the @testing-library/jest-dom matchers actually used by
// this test suite (only toBeDisabled / toBeEnabled are needed).
// We implement them inline instead of importing jest-dom to avoid the VM
// dynamic-import compatibility issue described above.
beforeAll(() => {
  expect.extend({
    toBeDisabled(element) {
      const tag = element && element.tagName && element.tagName.toUpperCase();
      const formTags = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTGROUP', 'OPTION', 'FIELDSET']);
      const pass = !!(element &&
        (formTags.has(tag) ? element.disabled === true : element.hasAttribute('disabled')));
      return {
        pass,
        message: () =>
          `expected ${element ? element.outerHTML : element} ${pass ? 'not ' : ''}to be disabled`,
      };
    },
    toBeEnabled(element) {
      const tag = element && element.tagName && element.tagName.toUpperCase();
      const formTags = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTGROUP', 'OPTION', 'FIELDSET']);
      const isDisabled = !!(element &&
        (formTags.has(tag) ? element.disabled === true : element.hasAttribute('disabled')));
      return {
        pass: !isDisabled,
        message: () =>
          `expected ${element ? element.outerHTML : element} ${isDisabled ? 'not ' : ''}to be enabled`,
      };
    },
    toBeInTheDocument(element) {
      const pass = element !== null && element !== undefined &&
        (element.ownerDocument ? element.ownerDocument.documentElement.contains(element) : false);
      return {
        pass,
        message: () =>
          `expected element ${pass ? 'not ' : ''}to be in the document`,
      };
    },
    toBeEmptyDOMElement(element) {
      const pass = element !== null && element !== undefined &&
        element.innerHTML === '';
      return {
        pass,
        message: () =>
          `expected element ${pass ? 'not ' : ''}to be an empty DOM element but received: ${element ? element.innerHTML : element}`,
      };
    },
    toHaveAttribute(element, attr, value) {
      const hasAttr = element !== null && element !== undefined && element.hasAttribute(attr);
      const pass = value === undefined
        ? hasAttr
        : hasAttr && element.getAttribute(attr) === value;
      return {
        pass,
        message: () => {
          if (value === undefined) {
            return `expected element ${pass ? 'not ' : ''}to have attribute "${attr}"`;
          }
          return `expected element ${pass ? 'not ' : ''}to have attribute "${attr}" with value "${value}" but got "${element ? element.getAttribute(attr) : undefined}"`;
        },
      };
    },
  });
});
