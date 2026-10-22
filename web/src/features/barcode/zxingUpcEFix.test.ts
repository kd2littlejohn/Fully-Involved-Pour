import { BarcodeFormat, BitArray, DecodeHintType, MultiFormatOneDReader } from '@zxing/library'
import { describe, expect, it } from 'vitest'
import { checkDigit } from './gtin'
import { applyUpcEFix } from './zxingUpcEFix'

// Renders barcodes as a single scan row (1 = bar) — no camera or canvas
// needed — and decodes it with the same ZXing reader the scanner uses.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const EAN_PARITY: string[] = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
// UPC-E parity for number system 0 (O = odd/L, E = even/G); system 1 is the inverse.
const UPCE_PARITY: string[] = ['EEEOOO', 'EEOEOO', 'EEOOEO', 'EEOOOE', 'EOEEOO', 'EOOEEO', 'EOOOEE', 'EOEOEO', 'EOEOOE', 'EOOEOE']

function ean13Bits(code: string): string {
  let bits = '101'
  const parity = EAN_PARITY[Number(code[0])] ?? ''
  for (let i = 1; i <= 6; i += 1) bits += (parity[i - 1] === 'L' ? L : G)[Number(code[i])]
  bits += '01010'
  for (let i = 7; i <= 12; i += 1) bits += R[Number(code[i])]
  return `${bits}101`
}

function upcEBits(code: string): string {
  const parity = UPCE_PARITY[Number(code[7])] ?? ''
  const odd = (i: number) => (parity[i] === 'O') === (code[0] === '0')
  let bits = '101'
  for (let i = 1; i <= 6; i += 1) bits += (odd(i - 1) ? L : G)[Number(code[i])]
  return `${bits}010101`
}

function decode(bits: string, formats: BarcodeFormat[]) {
  const moduleWidth = 2
  const quiet = 12 * moduleWidth
  const row = new BitArray(bits.length * moduleWidth + quiet * 2)
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === '1') for (let m = 0; m < moduleWidth; m += 1) row.set(quiet + i * moduleWidth + m)
  }
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, formats]])
  const result = new MultiFormatOneDReader(hints).decodeRow(0, row, hints)
  return { text: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()] }
}

const ALL = [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13]

describe('ZXing UPC-E', () => {
  // Runs before the fix is applied. If this starts passing, @zxing/library
  // fixed UPC-E upstream and zxingUpcEFix.ts can be deleted.
  it('is broken in the installed @zxing/library without the fix', () => {
    expect(() => decode(upcEBits('01234565'), [BarcodeFormat.UPC_E])).toThrow()
  })

  it('decodes UPC-E for every expansion rule once the fix is applied', () => {
    applyUpcEFix()
    for (const body of ['0123450', '0123451', '0123452', '0123453', '0123454', '0123455', '0123459']) {
      const code = `${body}${checkDigit(expandForCheck(body))}`
      expect(decode(upcEBits(code), ALL)).toEqual({ text: code, format: 'UPC_E' })
    }
  })

  it('decodes number-system-1 UPC-E codes', () => {
    applyUpcEFix()
    const body = '1234567'
    const code = `${body}${checkDigit(expandForCheck(body))}`
    expect(decode(upcEBits(code), ALL)).toEqual({ text: code, format: 'UPC_E' })
  })

  it('rejects a UPC-E whose parity encodes the wrong check digit', () => {
    applyUpcEFix()
    expect(() => decode(upcEBits('01234564'), [BarcodeFormat.UPC_E])).toThrow()
  })

  it('still decodes UPC-A and EAN-13', () => {
    applyUpcEFix()
    expect(decode(ean13Bits('0036000291452'), ALL)).toEqual({ text: '036000291452', format: 'UPC_A' })
    expect(decode(ean13Bits('4006381333931'), ALL)).toEqual({ text: '4006381333931', format: 'EAN_13' })
  })
})

// The 11 digits whose check digit a UPC-E carries: its UPC-A expansion.
function expandForCheck(body7: string): string {
  const ns = body7[0]
  const d = body7.slice(1)
  const last = d[5] ?? ''
  if ('012'.includes(last)) return `${ns}${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`
  if (last === '3') return `${ns}${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`
  if (last === '4') return `${ns}${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`
  return `${ns}${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`
}
