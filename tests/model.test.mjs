import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { clock, minute, eligible, emptyEvent, inputError, splitSkills } from '../src/model.ts'

const fixture = JSON.parse(readFileSync(new URL('../fixtures/community-repair.json', import.meta.url), 'utf8'))

test('validates initial event metadata and accepts fixture', () => {
  assert.match(inputError(emptyEvent()), /title/)
  assert.equal(inputError(fixture), '')
  assert.match(inputError({...fixture, date: '2026-02-30'}), /date/)
  assert.match(inputError({...fixture, zone: 'UTC+14:15'}), /offset/)
})

test('supports end of day and rejects ambiguous times', () => {
  assert.equal(minute('24:00'), 1440)
  assert.equal(clock(1440), '24:00')
  for (const invalid of ['24:01', '12:60', '9:00', '']) assert.equal(minute(invalid), -1)
})

test('validates edits and assigns no artificial conflict to touching availability', () => {
  const person = {...fixture.people[0], availability: [[540, 570], [570, 600]]}
  const task = fixture.tasks[0]
  assert.deepEqual(splitSkills(' Welcome, setup, welcome '), ['welcome','setup'])
  assert.equal(eligible(person, task), true)
  assert.equal(eligible({...person, availability: [[540, 569], [570, 600]]}, task), false)
  assert.equal(eligible({...person, limit: 59}, task), false)
  assert.match(inputError({...fixture, tasks: [{...task, start: task.end}]}), /time ranges/)
})
