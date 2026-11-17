import { describe, expect, it } from 'vitest'
import { parseCsv, rowsToText, sniffDelimiter } from './csv'

describe('parseCsv', () => {
  it('reads quoted cells with commas, line breaks and doubled quotes, as spreadsheets write them', () => {
    const text = 'date,name,steps\r\n2027-01-04,"Sweet spot, long","Warmup\n- 10m ramp 50-75%"\r\n2027-01-05,"Say ""easy""",- 40m 65%\r\n'
    expect(parseCsv(text)).toEqual([
      ['date', 'name', 'steps'],
      ['2027-01-04', 'Sweet spot, long', 'Warmup\n- 10m ramp 50-75%'],
      ['2027-01-05', 'Say "easy"', '- 40m 65%'],
    ])
  })

  it('drops blank lines and a byte-order mark, and keeps empty cells', () => {
    expect(parseCsv('﻿a,b,c\n\n1,,3\n,,\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })

  it('reads the last row without a line break after it', () => {
    expect(parseCsv('a,b\n1,"2"')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('takes a semicolon or tab delimiter from the first line', () => {
    expect(sniffDelimiter('date;sport;name;steps\n')).toBe(';')
    expect(sniffDelimiter('date\tname\n')).toBe('\t')
    expect(sniffDelimiter('"a;b",c,d\n')).toBe(',')
    expect(sniffDelimiter('just one column\n')).toBe(',')
    expect(parseCsv('date;name\n2027-01-04;"Tempo; steady"\n')).toEqual([
      ['date', 'name'],
      ['2027-01-04', 'Tempo; steady'],
    ])
  })
})

describe('rowsToText', () => {
  it('writes a row a line, cells joined by " | ", line breaks in a cell as " / ", trailing empty cells dropped', () => {
    expect(
      rowsToText([
        ['Week 1', 'Tue', 'Warmup\n- 10m 60%', ''],
        ['', '', '', ''],
        ['Week 1', 'Sat', 'Long ride'],
      ]),
    ).toBe('Week 1 | Tue | Warmup / - 10m 60%\nWeek 1 | Sat | Long ride')
  })
})
