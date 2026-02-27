const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function validateEmail(value: string): boolean { return EMAIL_RE.test(value) }
export function validateWeight(value: number): boolean { return Number.isFinite(value) && value > 0 && value <= 100 }
export function validateMultiplier(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 5 }
