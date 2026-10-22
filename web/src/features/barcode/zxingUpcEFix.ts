// Fixes UPC-E decoding in @zxing/library 0.23.0, which cannot decode a
// UPC-E barcode at all (found by the Phase 0 synthetic benchmark, see
// docs/BARCODE_POC.md). Three bugs in the JavaScript port:
//   1. UPCEReader.decodeMiddle returns a number, but UPCEANReader.decodeRow
//      expects { rowOffset, resultString } — the decoded digits are lost.
//   2. UPCEANReader.decodeRow calls the EAN-13 end guard and checksum
//      statically, so UPC-E's own 010101 end guard and checksum never run.
//   3. UPCEReader.convertUPCEtoUPCA compares character codes to numbers.
// iPhone Safari has no built-in barcode detector, so without this UPC-E
// (common on small bottles) would never scan there.
//
// This replaces UPCEReader.prototype.decodeRow with a port of the reference
// Java implementation. The reader class isn't exported, so it's found
// through a MultiFormatOneDReader's own reader list — the same class the
// browser reader instantiates. zxingUpcEFix.test.ts fails if a future
// release fixes this upstream, so the patch can then be deleted.

import { BarcodeFormat, DecodeHintType, MultiFormatOneDReader, NotFoundException, Result, ResultPoint, type BitArray } from '@zxing/library'
import { normalizeBarcode } from './gtin'

interface UpcEReaderClass {
  decodeDigit(row: BitArray, counters: Int32Array, rowOffset: number, patterns: Int32Array[]): number
  findStartGuardPattern(row: BitArray): Int32Array
  findGuardPatternWithoutCounters(row: BitArray, rowOffset: number, whiteFirst: boolean, pattern: Int32Array): Int32Array
  L_AND_G_PATTERNS: Int32Array[]
  NUMSYS_AND_CHECK_DIGIT_PATTERNS: Int32Array[]
}

interface ReaderLike {
  readers?: ReaderLike[]
  getBarcodeFormat?: () => BarcodeFormat
}

const MIDDLE_END_PATTERN = Int32Array.from([1, 1, 1, 1, 1, 1])

function findUpcEReader(reader: ReaderLike): ReaderLike | undefined {
  if (reader.getBarcodeFormat?.() === BarcodeFormat.UPC_E) return reader
  for (const child of reader.readers ?? []) {
    const found = findUpcEReader(child)
    if (found) return found
  }
  return undefined
}

let applied = false

export function applyUpcEFix(): void {
  if (applied) return
  applied = true
  const probe = new MultiFormatOneDReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_E]]])) as unknown as ReaderLike
  const upcE = findUpcEReader(probe)
  if (!upcE) return
  const proto = Object.getPrototypeOf(upcE) as { decodeRow: (rowNumber: number, row: BitArray) => Result }
  const Reader = proto.constructor as unknown as UpcEReaderClass

  proto.decodeRow = function decodeRow(rowNumber: number, row: BitArray): Result {
    const [startLeft = 0, startRight = 0] = Reader.findStartGuardPattern(row)
    const counters = new Int32Array(4)
    const end = row.getSize()
    let rowOffset = startRight
    let lgPatternFound = 0
    let digits = ''
    for (let x = 0; x < 6 && rowOffset < end; x += 1) {
      const bestMatch = Reader.decodeDigit(row, counters, rowOffset, Reader.L_AND_G_PATTERNS)
      digits += String(bestMatch % 10)
      for (const counter of counters) rowOffset += counter
      if (bestMatch >= 10) lgPatternFound |= 1 << (5 - x)
    }

    let text: string | null = null
    Reader.NUMSYS_AND_CHECK_DIGIT_PATTERNS.forEach((patterns, numSys) => {
      const d = patterns.indexOf(lgPatternFound)
      if (text === null && d !== -1) text = `${numSys}${digits}${d}`
    })
    if (text === null) throw new NotFoundException()

    const [endLeft = 0, endRight = 0] = Reader.findGuardPatternWithoutCounters(row, rowOffset, true, MIDDLE_END_PATTERN)
    // Quiet zone at least as wide as the end guard, as in the reference reader.
    const quietEnd = endRight + (endRight - endLeft)
    if (quietEnd >= row.getSize() || !row.isRange(endRight, quietEnd, false)) throw new NotFoundException()
    if (normalizeBarcode(text).error !== undefined) throw new NotFoundException()

    const left = (startLeft + startRight) / 2
    const right = (endLeft + endRight) / 2
    return new Result(text, new Uint8Array(0), 0, [new ResultPoint(left, rowNumber), new ResultPoint(right, rowNumber)], BarcodeFormat.UPC_E, Date.now())
  }
}
