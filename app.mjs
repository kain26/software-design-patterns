import {patterns} from './patterns.mjs';
import {createStage} from './scene.mjs';

const $ = id => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const catalog = $('catalog');
const timeline = $('timeline');
const play = $('play');
let pattern, index = -1, elapsed = 0, lastTime = 0, frameId = 0;
let playing = false;
let autoplay = false;
let lastCall;
const stage = createStage({stage:$('stage'),canvas:$('canvas'),labels:$('labels'),packet:$('packet'),fallback:$('fallback')}, draw);
const tabs = new Map();

for (const group of ['Behavioral','Creational','Structural']) {
  const section = document.createElement('section');
  section.className = 'catalog-group';
  const heading = document.createElement('h2');
  heading.textContent = group;
  section.append(heading);
  for (const item of patterns.filter(item => item.group === group)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.name;
    button.addEventListener('click',() => {
      location.hash = item.id;
      select(item);
    });
    section.append(button);
    tabs.set(item.id,button);
  }
  catalog.append(section);
}

function select(item) {
  if (item === pattern) return;
  pattern = item;
  for (const [id,button] of tabs) {
    if (id === pattern.id) button.setAttribute('aria-current','true');
    else button.removeAttribute('aria-current');
  }
  $('category').textContent = pattern.group;
  $('pattern-name').textContent = pattern.name;
  for (const id of ['intro','use','cost']) $(id).textContent = pattern[id];
  $('example').textContent = pattern.code;
  timeline.replaceChildren(...pattern.steps.map((step,i) => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const number = document.createElement('b');
    number.textContent = i+1;
    number.setAttribute('aria-hidden','true');
    button.append(number,step.title);
    button.addEventListener('click',() => jump(i,true));
    row.append(button);
    return row;
  }));
  stage.setPattern(pattern);
  jump(-1);
  if (!tabs.get(pattern.id).matches(':focus')) {
    const button = tabs.get(pattern.id);
    const bounds = button.getBoundingClientRect();
    const left = catalog.getBoundingClientRect().left;
    if (bounds.left < left || bounds.right > left+catalog.clientWidth) catalog.scrollLeft += bounds.left-left-12;
  }
}

function duration(step) {
  return motion.matches ? 1100 : step.calls.length*720 + 460;
}

function syncControls() {
  $('play-label').textContent = playing ? 'Pause' : (index === pattern.steps.length-1 && elapsed >= duration(pattern.steps[index]) ? 'Replay' : 'Play');
  $('play-icon').textContent = playing ? 'Ⅱ' : '▶';
  $('prev').disabled = index < 0;
  $('next').disabled = index >= pattern.steps.length-1;
}

function draw() {
  if (!pattern) return;
  const visible = new Set(Object.entries(pattern.nodes).filter(([,node])=>!node.hidden).map(([id])=>id));
  const roles = {};
  const step = pattern.steps[index];
  const fraction = step ? elapsed/duration(step) : 0;
  for (let i=0;i<=index;i++) {
    if (i === index && fraction < .68) break;
    for (const node of pattern.steps[i].reveal) visible.add(node);
    Object.assign(roles,pattern.steps[i].roles);
  }
  const slot = motion.matches || !step ? -1 : Math.min(step.calls.length-1,Math.floor(elapsed/720));
  const call = slot < 0 ? undefined : step.calls[slot];
  stage.draw(visible,roles,call,call ? Math.min(1,(elapsed-slot*720)/720) : 0);
  const message = call?.[2] ?? step?.calls.map(call=>call[2]).join(' → ');
  if (message !== lastCall) {
    $('current-call').hidden = !message;
    $('current-call').textContent = message ?? '';
    lastCall = message;
  }
}

function showStep() {
  const step = pattern.steps[index];
  $('phase').textContent = step ? `Step ${index+1}` : 'Before you start';
  $('count').textContent = `${index+1} / ${pattern.steps.length} steps`;
  $('step-title').textContent = step?.title ?? 'Meet the objects';
  $('step-text').textContent = step?.text ?? 'Play the full interaction or select a step. Follow the yellow marker to see where each call goes.';
  [...timeline.children].forEach((row,i) => {
    if (i === index) row.firstElementChild.setAttribute('aria-current','step');
    else row.firstElementChild.removeAttribute('aria-current');
  });
  draw();
  syncControls();
}

function halt() {
  cancelAnimationFrame(frameId);
  playing = false;
  lastTime = 0;
}

function jump(target, animate = false) {
  halt();
  autoplay = false;
  index = target;
  elapsed = target >= 0 && !animate ? duration(pattern.steps[target]) : 0;
  if (animate && motion.matches) elapsed = duration(pattern.steps[target]);
  showStep();
  if (animate && !motion.matches) start();
}

function tick(time) {
  if (lastTime) elapsed += (time-lastTime)*Number($('speed').value);
  lastTime = time;
  const end = duration(pattern.steps[index]);
  if (elapsed >= end) {
    elapsed = end;
    draw();
    if (!autoplay || index === pattern.steps.length-1) {
      halt();
      syncControls();
      return;
    }
    index++;
    elapsed = 0;
    showStep();
  } else draw();
  frameId = requestAnimationFrame(tick);
}

function start() {
  playing = true;
  lastTime = 0;
  syncControls();
  frameId = requestAnimationFrame(tick);
}

play.addEventListener('click',() => {
  if (playing) {
    halt();
    syncControls();
    return;
  }
  autoplay = true;
  if (index < 0 || elapsed >= duration(pattern.steps[index])) {
    index = (index+1)%pattern.steps.length;
    elapsed = 0;
  }
  showStep();
  start();
});
$('prev').addEventListener('click',()=>jump(index-1));
$('next').addEventListener('click',()=>jump(index+1,true));
$('reset').addEventListener('click',()=>jump(-1));
motion.addEventListener('change',()=>jump(index));
document.addEventListener('keydown',event=>{
  if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest('button, select, summary, input, textarea, [contenteditable]')) return;
  const control = {' ':play, ArrowLeft:$('prev'), ArrowRight:$('next'), r:$('reset')}[event.key];
  if (!control) return;
  event.preventDefault();
  control.click();
});

const selectHash = () => select(patterns.find(item=>item.id===location.hash.slice(1)) ?? patterns[0]);
window.addEventListener('hashchange',selectHash);
selectHash();
