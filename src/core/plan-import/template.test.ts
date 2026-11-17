import { describe, expect, it } from 'vitest'
import { parseIntervalsText } from '../workout/io/intervals-text'
import { workoutStats } from '../workout/stats'
import { sessionFromFile } from '../multisport/build'
import { parseCsv } from './csv'
import { isPlanTemplate, readTemplate, TEMPLATE_CSV, templateSteps } from './template'

describe('the template example', () => {
  it('reads every row into a session, steps a line each', () => {
    const rows = parseCsv(TEMPLATE_CSV)
    expect(isPlanTemplate(rows)).toBe(true)
    const { doc, problems } = readTemplate(rows)
    expect(problems).toEqual([])
    expect(doc.items.map((i) => [i.date, i.sport, i.name])).toEqual([
      ['2027-01-04', 'bike', 'Endurance 60'],
      ['2027-01-05', 'run', 'Easy run'],
      ['2027-01-06', 'bike', 'Sweet spot 3x12'],
      ['2027-01-07', 'swim', 'CSS 10x100'],
      ['2027-01-08', 'other', 'Strength'],
      ['2027-01-09', 'bike', 'Threshold 4x8'],
      ['2027-01-10', 'run', 'Long run'],
    ])
    expect(doc.items[2]!.steps).toBe('Warmup\n- 10m ramp 50-75%\nMain set 3x\n- 12m 90%\n- 5m 55%\nCooldown\n- 10m 50%')
    expect(doc.items[4]!.notes).toBe('Squats, lunges, core.')
    expect(doc.items[0]!.where).toBe('Row 2 · 2027-01-04')
  })

  it('has steps CrankHog’s own importers read without an error', () => {
    const { doc } = readTemplate(parseCsv(TEMPLATE_CSV))
    for (const i of doc.items) {
      if (i.sport === 'bike') {
        const r = parseIntervalsText(i.steps)
        expect(r.errors, i.name).toEqual([])
        expect(r.workout.segments.length, i.name).toBeGreaterThan(0)
      } else {
        const r = sessionFromFile(`${i.name}.txt`, `sport: ${i.sport}\nname: ${i.name}\n\n${i.steps}\n`, {}, 0)
        expect(r.errors, i.name).toEqual([])
      }
    }
    // the repeat ends at the cool-down's title: 10 + 3 x 17 + 10 minutes
    expect(workoutStats(parseIntervalsText(doc.items[2]!.steps).workout, 250).durationS).toBe((10 + 3 * 17 + 10) * 60)
  })
})

describe('readTemplate', () => {
  it('takes week and day in place of a date, headers in any case and order, and bike when sport is left out', () => {
    const rows = [
      ['Name', 'WEEK', 'Day', 'Steps'],
      ['Openers', '1', 'Tue', '- 30m 65%'],
      ['Long', '2', '7', '- 3h 65%'],
      ['Any day', '3', '', '- 1h 60%'],
    ]
    const { doc, problems } = readTemplate(rows)
    expect(problems).toEqual([])
    expect(doc.items.map((i) => [i.week, i.weekday, i.sport, i.where])).toEqual([
      [1, 1, 'bike', 'Row 2 · Week 1, Tue'],
      [2, 6, 'bike', 'Row 3 · Week 2, Sun'],
      [3, undefined, 'bike', 'Row 4 · Week 3'],
    ])
  })

  it('says which rows it couldn’t read and why, and reads the rest', () => {
    const rows = [
      ['date', 'sport', 'name', 'steps'],
      ['2027-01-04', 'rowing', 'Erg', '- 20m'],
      ['2027-02-30', 'bike', 'Tempo', '- 1h 80%'],
      ['', 'run', '', '- 30m'],
      ['2027-01-05', 'Running', 'Easy', '- 30m Z2 HR'],
      ['', '', '', ''],
    ]
    const { doc, problems } = readTemplate(rows)
    expect(doc.items.map((i) => [i.name, i.sport])).toEqual([['Easy', 'run']])
    expect(problems).toEqual([
      { where: 'Row 2', reason: 'Erg: sport "rowing" isn\'t bike, run, swim or other.' },
      { where: 'Row 3', reason: 'Tempo: the date "2027-02-30" isn\'t a day written YYYY-MM-DD.' },
      { where: 'Row 4', reason: 'it has no name.' },
    ])
  })

  it('rejects bad weeks and days', () => {
    const { problems } = readTemplate([
      ['week', 'day', 'name', 'steps'],
      ['0', 'Mon', 'A', '- 1h 60%'],
      ['2', 'Funday', 'B', '- 1h 60%'],
    ])
    expect(problems.map((p) => p.reason)).toEqual(['A: the week "0" isn\'t a number from 1 to 104.', 'B: the day "Funday" isn\'t Mon to Sun, or 1 to 7.'])
  })

  it('isn’t fooled by a sheet that isn’t the template', () => {
    expect(isPlanTemplate([['Week', 'Mon', 'Tue', 'Wed']])).toBe(false)
    expect(isPlanTemplate([['date', 'name']])).toBe(false)
    expect(isPlanTemplate([])).toBe(false)
    expect(readTemplate([['date', 'name']]).problems).toHaveLength(1)
  })
})

describe('templateSteps', () => {
  it('reads a step a line from line breaks or semicolons', () => {
    expect(templateSteps(' - 10m 60% ;- 20m 70%\r\n- 5m 50% ')).toBe('- 10m 60%\n- 20m 70%\n- 5m 50%')
  })
})
