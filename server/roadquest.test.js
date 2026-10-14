import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRace, chooseRoad, tickRoom, decideCase, snapshot } from './roadquest.js';

function setup(code) { const room = createRoom(code); const driver = addPlayer(room, 'leo', 'Leo', 10000); const officer = addPlayer(room, 'maya', 'Maya', 10000); startRace(room, 10000); return { room, driver, officer }; }
test('seat belt, school zone and pedestrian crossing are enforced by the server',()=>{
  for(const [rule,progress,speed] of [['seatbelt',.1,15],['school',.719,35],['crossing',.839,24]]){
    const {room,driver}=setup(`EXTRA${rule}`);driver.city='old';chooseRoad(room,driver,'oneway');
    driver.from='old';driver.to='harbor';driver.progress=progress;driver.speed=speed;driver.lastInput=10000;
    if(rule==='seatbelt')driver.seatbelt=false;
    tickRoom(room,.05,10000);assert.equal(room.cases[0]?.rule,rule);assert.equal(driver.status,'detained');
    decideCase(room,driver,room.cases[0].id,'pay');assert.equal(driver.status,'driving');
    if(rule==='seatbelt')assert.equal(driver.seatbelt,true);
  }
});
test('crossing a red signal stops the driver and a paid fine cannot erase the violation', () => {
  const { room, driver } = setup('TESTRED'); chooseRoad(room, driver, 'coast');
  driver.progress = .479; driver.speed = 50; driver.lastInput = 15000;
  tickRoom(room, .05, 15000);
  assert.equal(driver.status, 'detained'); assert.equal(room.cases[0].rule, 'signal'); assert.equal(driver.violations, 1);
  decideCase(room, driver, room.cases[0].id, 'pay', 15010);
  assert.equal(driver.status, 'driving'); assert.equal(driver.credits, 350); assert.equal(driver.violations, 1);
  assert.throws(() => decideCase(room, driver, room.cases[0].id, 'pay'), /already/);
});
test('stop sign requires a genuine stop and the officer can only grant one warning', () => {
  const { room, driver, officer } = setup('TESTSTOP'); chooseRoad(room, driver, 'west');
  driver.progress = .439; driver.speed = 40; driver.lastInput = 10000; tickRoom(room, .05, 10000);
  assert.equal(room.cases[0].rule, 'stop');
  assert.throws(() => decideCase(room, driver, room.cases[0].id, 'warn'), /officer/);
  decideCase(room, officer, room.cases[0].id, 'warn'); assert.equal(driver.warnings, 1); assert.equal(driver.credits, 500); assert.equal(driver.violations, 1);
  driver.progress = .2; driver.speed = 100; driver.input.gas = true;
  for (let i = 0; i < 24; i++) { driver.lastInput = 10000 + i * 50; tickRoom(room, .05, 10000 + i * 50); }
  assert.equal(driver.status, 'detained'); assert.equal(room.cases[0].rule, 'speed');
  assert.throws(() => decideCase(room, officer, room.cases[0].id, 'warn'), /one warning/);
});
test('holding still before a stop line satisfies the rule and reverse one-way entry is ticketed', () => {
  const { room, driver } = setup('TESTWAY'); chooseRoad(room, driver, 'west');
  driver.progress = .35; driver.speed = 0;
  for(let i=0;i<16;i++){driver.lastInput=10000+i*50;tickRoom(room,.05,10000+i*50);}
  assert.equal(driver.stopCleared, true);
  driver.status = 'city'; driver.city = 'harbor'; chooseRoad(room, driver, 'oneway'); driver.progress = .16; driver.lastInput = 10000; tickRoom(room,.05,10000);
  assert.equal(room.cases[0].rule, 'oneway'); decideCase(room,driver,room.cases[0].id,'pay');
  assert.equal(driver.city,'harbor'); assert.equal(driver.status,'city'); assert.equal(driver.road,null);
});
test('completed cities determine qualification and fewest violations determines winner', () => {
  const { room, driver } = setup('TESTRANK');
  room.phase = 'lobby'; const nina = addPlayer(room, 'nina', 'Nina', 10000); room.phase = 'racing';
  driver.visited = ['metro','harbor','hill','old']; driver.status = 'finished'; driver.violations = 1;
  nina.visited = ['metro','harbor','hill']; nina.violations = 0;
  assert.equal(snapshot(room, 11000).standings[0].slot, 'leo', 'an unfinished clean driver cannot beat a finisher');
  nina.visited.push('old'); nina.status = 'finished'; nina.activeTime = 90;
  tickRoom(room,.05,11000); const publicState = snapshot(room,11000);
  assert.equal(publicState.phase,'finished'); assert.equal(publicState.standings[0].finished,true);
  assert.equal(publicState.standings[0].slot,'nina', 'fewest violations beats faster driving');
  nina.violations = 1; driver.activeTime = 45;
  assert.equal(snapshot(room,11000).standings[0].slot,'leo', 'equal violations use active driving time');
  assert.equal(JSON.stringify(publicState).includes(driver.token),false);
  assert.throws(()=>chooseRoad(room,driver,'coast'),/Choose a road/);
});
