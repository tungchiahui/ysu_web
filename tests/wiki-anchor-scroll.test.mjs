import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createWikiAnchorScroller } from '../app/utils/wiki-anchor-scroll.ts'

function setup(reducedMotion = false) {
  let position = 0, target = 2000, arrived = 0, time = 0, sequence = 0
  const frames = new Map()
  const scroller = createWikiAnchorScroller({
    target: () => target, position: () => position, write: top => { position = top },
    requestFrame: callback => { frames.set(++sequence, callback); return sequence },
    cancelFrame: id => frames.delete(id), reducedMotion: () => reducedMotion,
    onArrive: () => arrived++
  })
  return {
    scroller, get position() { return position }, get arrived() { return arrived },
    target(value) { target = value },
    step(count = 1) {
      for (let i = 0; i < count; i++) {
        time += 16
        const callbacks = [...frames.values()]; frames.clear()
        callbacks.forEach(callback => callback(time))
      }
    }
  }
}

describe('Wiki anchor animation under layout shifts', () => {
  it('lands exactly and tracks a moving target without an instant jump', () => {
    const run = setup()
    run.scroller.refresh(); run.step(8)
    assert.ok(run.position > 0 && run.position < 2000)
    const before = run.position
    run.target(3500); run.step()
    assert.equal(run.position, before)
    run.step(60)
    assert.equal(run.position, 3500)
    assert.equal(run.arrived, 1)
  })
  it('corrects images that finish long after initial arrival', () => {
    const run = setup()
    run.scroller.refresh(); run.step(60)
    run.step(1000) // Slow media exceeds the old 2.6s retry window.
    run.target(5000); run.scroller.refresh(); run.step(60)
    assert.equal(run.position, 5000)
  })
  it('cancels both queued animation and subsequent layout corrections', () => {
    const run = setup()
    run.scroller.refresh(); run.step(6)
    const before = run.position
    run.scroller.cancel(); run.target(6000); run.scroller.refresh(); run.step(100)
    assert.equal(run.position, before)
    assert.equal(run.arrived, 0)
  })
  it('supports direct hash alignment and reduced motion without animation', () => {
    for (const reduced of [false, true]) {
      const run = setup(reduced)
      run.scroller.refresh(reduced); run.step()
      assert.equal(run.position, 2000)
    }
  })
  it('stops safely when the heading disappears', () => {
    const run = setup()
    run.scroller.refresh(); run.target(null); run.step(60)
    assert.equal(run.position, 0)
    assert.equal(run.arrived, 0)
  })
})
