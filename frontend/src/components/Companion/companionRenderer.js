/**
 * Companion canvas renderer
 * Wraps the original ViBe prototype drawing code (vibe_companions (2).html)
 * inside an ES module factory. React passes props via setters; we run the
 * requestAnimationFrame loop ourselves and expose start()/stop().
 *
 * NOTE: assembled by hand from the prototype. Do not refactor internals.
 */

// ── Mood message table (exported for the React widget to surface messages
//    alongside the canvas, so the user sees the companion's "voice" as well
//    as its mood). Same table the in-canvas mood code uses. Keys match
//    the 7 prototype moods + 'studying_break'. Keep in sync with the
//    MSGS const below the IIFE — kept duplicated for now because the
//    factory's internal MSGS is captured in the closure used by every
//    call to drawX()/loop().
export const MSGS = {
  happy: ['Your companion loves you! 💕','One step at a time — you got this!','Looking great! Keep it up! ✨','You make your companion so happy! 🌟'],
  sad: ['Please come back... I miss you 🥺','Just one tiny lesson? For me?','I\'ll be right here waiting... 💙','Don\'t leave me alone! 😢'],
  sleeping: ['Zzz... dreaming of your return 💤','So sleepy without you here...','Wake me up when you\'re ready! 😴'],
  celebrating: ['WE DID IT!! I\'m SO happy!! 🎊','You are absolutely AMAZING!! 🌟','This is the BEST day ever!! 🎉','You\'re my favourite human!! 💖'],
  excited: ['LET\'S GOOO!! On fire!! 🔥','Your streak is INCREDIBLE!! ⚡','Nothing can stop you now!! 💪'],
  angry: ['Hey!! Come back and study!! 😤','I\'m upset... but I still love you 😠','Don\'t make me wait too long! ⏰'],
  studying: ['Shh... deep focus mode! 📖','Reading page after page... 📚','Taking notes like a pro! ✍️','Learning hard, one page at a time! 🤓'],
  studying_break: ['Go take a break and come back! ☕','Stretch a little — I\'ll wait right here! ☕','Sipping coffee till you\'re back! ☕','Take five, you\'ve earned it. Come back soon 💛'],
  neutral: ['Ready when you are! 💛','Let\'s start something new! 🌱','Pick a course and I\'ll be right here! ✨','No rush — your journey begins when you\'re ready! 🌟'],
  newJourney: ['You enrolled a new course — let\'s begin! 🚀','A new journey starts today! 🌟','Fresh start! Let\'s grow together! 🌱','New course, new goals — I\'m right here with you! 💛'],
};

export function createCompanionRenderer(canvas, opts = {}) {
  // The prototype uses a global `G` for its canvas context (was const cv=...
  // G=cv.getContext('2d') at the top). Replace that with our injected canvas.
  const G = canvas.getContext('2d');

const W=320,H=360,CX=160,CY=195;
// Per-instance state. These `let`s are lexically inside createCompanionRenderer
// (the factory spans line 10–710), so each renderer instance gets its own copy
// of `animal`, `mood`, `prog`, `idleDays`, `forced`, and `quizScore`. Visually
// it looks module-level because nothing here is indented, but the lack of
// indentation was a leftover from the prototype and is a footgun: a future
// contributor could refactor "this looks like a constant" to top-level and
// silently introduce cross-widget state collisions. Don't move them.
let animal='panda',mood='happy',prog=5,idleDays=0,forced=null;
let quizScore=60;
const GOOD_SCORE=85;
function hasGrad(){return quizScore>GOOD_SCORE;}
let T=0,bT=0,nB=130,bP=0,bobY=0,tailT=0,breathT=0,zzP=0,sparkT=0;
let headTurnT=0,headTurn=0;
let lastProgFrame=0,studySub=0,studySubT=0;
let conf=[];

const STAGES=[
  {n:'Baby',e:'🥚',s:.46},
  {n:'Toddler',e:'🐣',s:.57},
  {n:'Child',e:'🌱',s:.68},
  {n:'Teen',e:'🌿',s:.79},
  {n:'Young Adult',e:'🌸',s:.90},
  {n:'Adult',e:'⭐',s:1.0}
];
const SI=p=>p>=83?5:p>=67?4:p>=50?3:p>=33?2:p>=17?1:0;
const AMOOD=(p,i)=>p>=100?'celebrating':i>=5?'sleeping':i>=3?'angry':i>=1?'sad':p>=40?'excited':'happy';
const MSGS={
  happy:['Your companion loves you! 💕','One step at a time — you got this!','Looking great! Keep it up! ✨','You make your companion so happy! 🌟'],
  sad:['Please come back... I miss you 🥺','Just one tiny lesson? For me?','I\'ll be right here waiting... 💙','Don\'t leave me alone! 😢'],
  sleeping:['Zzz... dreaming of your return 💤','So sleepy without you here...','Wake me up when you\'re ready! 😴'],
  celebrating:['WE DID IT!! I\'m SO happy!! 🎊','You are absolutely AMAZING!! 🌟','This is the BEST day ever!! 🎉','You\'re my favourite human!! 💖'],
  excited:['LET\'S GOOO!! On fire!! 🔥','Your streak is INCREDIBLE!! ⚡','Nothing can stop you now!! 💪'],
  angry:['Hey!! Come back and study!! 😤','I\'m upset... but I still love you 😠','Don\'t make me wait too long! ⏰'],
  studying:['Shh... deep focus mode! 📖','Reading page after page... 📚','Taking notes like a pro! ✍️','Learning hard, one page at a time! 🤓'],
  studying_break:['Go take a break and come back! ☕','Stretch a little — I\'ll wait right here! ☕','Sipping coffee till you\'re back! ☕','Take five, you\'ve earned it. Come back soon 💛'],
  neutral:['Ready when you are! 💛','Let\'s start something new! 🌱','Pick a course and I\'ll be right here! ✨','No rush — your journey begins when you\'re ready! 🌟'],
  newJourney:['You enrolled a new course — let\'s begin! 🚀','A new journey starts today! 🌟','Fresh start! Let\'s grow together! 🌱','New course, new goals — I\'m right here with you! 💛']
};
const MPILLS={
  happy:['#e8f5e9','#2e7d32','😊'],sad:['#fff3e0','#e65100','😢'],
  sleeping:['#ede7f6','#4527a0','😴'],celebrating:['#fce4ec','#880e4f','🎉'],
  excited:['#e1f5fe','#01579b','🔥'],angry:['#ffebee','#b71c1c','😠'],
  studying:['#fff8e1','#8d6e00','📚'],
  studying_break:['#efebe9','#4e342e','☕'],
  neutral:['#f0f4f8','#4a5568','🌱'],
  newJourney:['#e0f7fa','#006064','🚀']
};

function spawnConf(){conf=[];for(let i=0;i<44;i++)conf.push({x:CX+(Math.random()-.5)*240,y:80,vx:(Math.random()-.5)*7,vy:-10-Math.random()*5,c:['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#ff6bb5'][i%6],s:4+Math.random()*5,l:1,d:.011+Math.random()*.008,r:Math.random()*6.28});}

/* refresh(): DOM-only sync in prototype. No-op here. */
function refresh(){}


const P2=Math.PI*2;
function C(x,y,r,f,s,lw){G.beginPath();G.arc(x,y,r,0,P2);if(f){G.fillStyle=f;G.fill();}if(s){G.strokeStyle=s;G.lineWidth=lw||2;G.stroke();}}
function E(x,y,rx,ry,rot,f,s,lw){G.beginPath();G.ellipse(x,y,rx,ry,rot||0,0,P2);if(f){G.fillStyle=f;G.fill();}if(s){G.strokeStyle=s;G.lineWidth=lw||2;G.stroke();}}
function T3(p,f,s,lw){G.beginPath();G.moveTo(p[0][0],p[0][1]);p.slice(1).forEach(q=>G.lineTo(q[0],q[1]));G.closePath();if(f){G.fillStyle=f;G.fill();}if(s){G.strokeStyle=s;G.lineWidth=lw||1.5;G.stroke();}}

function shadow(x,y,rx,ry){G.save();G.globalAlpha=.09;E(x,y,rx,ry,0,'#333');G.restore();}
function blush(x,y,rx,ry){G.save();G.globalAlpha=.38;E(x,y,rx||15,ry||9,0,'#ffb3c6');G.restore();}
function lerp(a,b,t){return a+(b-a)*t;}

/* tiny toe-bean dots arced across the top of a paw */
function toeDots(cx,cy,r,color,n){
  n=n||3;
  for(let i=0;i<n;i++){
    const a=(i-(n-1)/2)*.66;
    C(cx+Math.sin(a)*r*.8,cy-Math.cos(a)*r*.8,r*.26,color);
  }
}
/* chubby rounded limb: fur ellipse + glossy highlight + round paw pad + toe beans */
function limb(x,y,rx,ry,rot,fur,stroke,px,py,pr,pad,toe){
  E(x,y,rx,ry,rot,fur,stroke,1.3);
  G.save();G.globalAlpha=.22;E(x-rx*.22,y-ry*.32,rx*.42,ry*.36,rot,'#ffffff');G.restore();
  C(px,py,pr,pad,stroke,1);
  toeDots(px,py,pr,toe,3);
}

function drawEye(x,y,open,m,iris,pup,es){
  es=es||1;
  iris=iris||'#3a2010';pup=pup||'#150805';
  const closed=open<.09||m==='sleeping';
  G.save();G.globalAlpha=.07;E(x,y+3*es,16*es,11*es,0,'#000');G.restore();
  const grad=G.createRadialGradient(x-3*es,y-4*es,1,x,y,14*es);
  grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#f2ece8');
  E(x,y,14*es,15*es,0,grad,'#ddd5cc',1.2);
  if(closed){
    G.save();
    if(m==='sleeping'){
      // soft peaceful closed eyes — gentle downward arc with downward lashes, no spikes
      G.strokeStyle=iris;G.lineWidth=2.8;G.lineCap='round';
      G.beginPath();G.moveTo(x-12*es,y+3*es);G.quadraticCurveTo(x,y+10*es,x+12*es,y+3*es);G.stroke();
      // gentle downward lashes — not spiky, just soft curves
      G.lineWidth=1.8;
      [[x-8*es,y+2*es,x-11*es,y+8*es],[x,y+1*es,x,y+9*es],[x+8*es,y+2*es,x+11*es,y+8*es]].forEach(([x1,y1,x2,y2])=>{
        G.beginPath();G.moveTo(x1,y1);G.quadraticCurveTo((x1+x2)/2,(y1+y2)/2+2,x2,y2);G.stroke();
      });
      // soft blush circles for sleeping
      blush(x-30*es,y+8*es,8*es,5*es);
      blush(x+30*es,y+8*es,8*es,5*es);
    } else {
      // other closed states (happy etc.) — simple nice arc
      G.strokeStyle=iris;G.lineWidth=2.8;G.lineCap='round';
      G.beginPath();G.moveTo(x-11*es,y+1);G.quadraticCurveTo(x,y+8*es,x+11*es,y+1);G.stroke();
      G.lineWidth=2.2;
      [[x-10*es,y-1,x-14*es,y-7*es],[x,y-2,x,y-9*es],[x+10*es,y-1,x+14*es,y-7*es]].forEach(([x1,y1,x2,y2])=>{G.beginPath();G.moveTo(x1,y1);G.lineTo(x2,y2);G.stroke();});
    }
    G.restore();return;
  }
  if(m==='angry'){
    G.save();G.strokeStyle='#1a0804';G.lineWidth=3.8;G.lineCap='round';
    const d=x<0?1:-1;G.beginPath();G.moveTo(x-13*d*es,y-18*es);G.lineTo(x+9*d*es,y-12*es);G.stroke();G.restore();
  }
  const ig=G.createRadialGradient(x-2*es,y-3*es,1,x,y,13*es);
  ig.addColorStop(0,iris+'cc');ig.addColorStop(1,iris);
  E(x,y,13*es,(m==='celebrating'?16:13)*es,0,ig);
  const pg=G.createRadialGradient(x,y,0,x,y,8*es);
  pg.addColorStop(0,'#2a1008');pg.addColorStop(1,pup);
  E(x+1,y+1,7*es,8*es,0,pg);
  C(x-4*es,y-5*es,4.8*es,'#ffffff');C(x+4*es,y-1,2.4*es,'#ffffff');
  G.save();G.globalAlpha=.55;C(x-1,y+5*es,1.5*es,'#ffffff');G.restore();
  if(m==='sad'){G.save();G.globalAlpha=.3;E(x,y+5*es,12*es,8*es,0,'#aad4ff');G.restore();}
  if(m==='happy'||m==='excited'||m==='celebrating'){
    const gx=x+(x<0?-21*es:21*es),gy=y-23*es;
    G.save();G.globalAlpha=.72+Math.sin(sparkT*3)*.22;G.fillStyle='#FFD700';
    G.beginPath();
    for(let i=0;i<8;i++){const a=i*Math.PI/4+sparkT*1.2;const rr=(i%2===0?7:3)*es;G.lineTo(gx+Math.cos(a)*rr,gy+Math.sin(a)*rr);}
    G.closePath();G.fill();G.restore();
  }
}

function drawMouth(x,y,m){
  G.save();G.lineCap='round';G.lineJoin='round';G.lineWidth=3.2;G.strokeStyle='#1e0c06';
  if(m==='happy'||m==='excited'){
    G.beginPath();G.moveTo(x-12,y);G.quadraticCurveTo(x,y+15,x+12,y);G.stroke();
    G.beginPath();G.fillStyle='#ff8fab';G.arc(x,y+8,6.5,0,Math.PI);G.fill();
    G.strokeStyle='#d45075';G.lineWidth=1.5;G.beginPath();G.moveTo(x,y+3);G.lineTo(x,y+15);G.stroke();
  } else if(m==='celebrating'){
    G.beginPath();G.moveTo(x-15,y-2);G.quadraticCurveTo(x,y+20,x+15,y-2);G.stroke();
    G.beginPath();G.fillStyle='#ff5c8a';G.arc(x,y+9,8.5,0,Math.PI);G.fill();
    G.strokeStyle='#c0306a';G.lineWidth=1.5;G.beginPath();G.moveTo(x,y+2);G.lineTo(x,y+17);G.stroke();
  } else if(m==='sad'){
    G.beginPath();G.moveTo(x-11,y+10);G.quadraticCurveTo(x,y-4,x+11,y+10);G.stroke();
    G.save();G.fillStyle='#7ec8f0';G.globalAlpha=.78;
    const td=Math.abs(Math.sin(T*.04))*14;
    [[x-18,y+18],[x+18,y+18]].forEach(([tx,ty])=>{G.beginPath();G.moveTo(tx,ty+td-10);G.quadraticCurveTo(tx+5,ty+td+2,tx,ty+td+8);G.quadraticCurveTo(tx-5,ty+td+2,tx,ty+td-10);G.fill();});
    G.restore();
  } else if(m==='sleeping'){
    G.beginPath();G.moveTo(x-7,y+4);G.quadraticCurveTo(x,y+9,x+7,y+4);G.stroke();
  } else if(m==='angry'){
    G.beginPath();G.moveTo(x-11,y+5);G.quadraticCurveTo(x,y-9,x+11,y+5);G.stroke();
    G.save();G.strokeStyle='#ff4444';G.lineWidth=2.8;G.globalAlpha=.65;G.lineCap='round';
    [[x-18,y-22,x-13,y-33],[x,y-24,x,y-35],[x+18,y-22,x+13,y-33]].forEach(([ax,ay,bx,by])=>{G.beginPath();G.moveTo(ax,ay);G.lineTo(bx,by);G.stroke();});
    G.restore();
  } else if(m==='studying'){
    G.beginPath();G.moveTo(x-6,y+3);G.quadraticCurveTo(x,y+6,x+6,y+3);G.stroke();
  } else if(m==='neutral'){
    // subtle small smile — encouraging but calm
    G.beginPath();G.moveTo(x-9,y+4);G.quadraticCurveTo(x,y+10,x+9,y+4);G.stroke();
  }
  G.restore();
}

/* penguin's mouth is the split-line across its beak — shape changes with mood, just like the other companions' mouths */
function drawBeak(x,y,m){
  G.save();G.lineCap='round';G.lineJoin='round';
  if(m==='happy'||m==='excited'){
    G.strokeStyle='#c07008';G.lineWidth=2.2;
    G.beginPath();G.moveTo(x-17,y-1);G.quadraticCurveTo(x,y+9,x+17,y-1);G.stroke();
  } else if(m==='celebrating'){
    G.beginPath();G.moveTo(x-18,y-2);G.quadraticCurveTo(x,y+16,x+18,y-2);G.closePath();
    G.fillStyle='#7a3c04';G.fill();G.strokeStyle='#c07008';G.lineWidth=2;G.stroke();
  } else if(m==='sad'){
    G.strokeStyle='#c07008';G.lineWidth=2.2;
    G.beginPath();G.moveTo(x-15,y+6);G.quadraticCurveTo(x,y-6,x+15,y+6);G.stroke();
    G.save();G.fillStyle='#7ec8f0';G.globalAlpha=.78;
    const td=Math.abs(Math.sin(T*.04))*14;
    [[x-22,y+8],[x+22,y+8]].forEach(([tx,ty])=>{G.beginPath();G.moveTo(tx,ty+td-10);G.quadraticCurveTo(tx+5,ty+td+2,tx,ty+td+8);G.quadraticCurveTo(tx-5,ty+td+2,tx,ty+td-10);G.fill();});
    G.restore();
  } else if(m==='angry'){
    G.strokeStyle='#a85606';G.lineWidth=2.4;
    G.beginPath();G.moveTo(x-15,y+5);G.quadraticCurveTo(x,y-8,x+15,y+5);G.stroke();
  } else if(m==='sleeping'){
    G.strokeStyle='#c07008';G.lineWidth=2.2;
    G.beginPath();G.moveTo(x-9,y+2);G.lineTo(x+9,y+2);G.stroke();
  } else if(m==='neutral'){
    // subtle small smile — encouraging but calm
    G.strokeStyle='#c07008';G.lineWidth=2.2;
    G.beginPath();G.moveTo(x-10,y+1);G.quadraticCurveTo(x,y+8,x+10,y+1);G.stroke();
  } else {
    G.strokeStyle='#c07008';G.lineWidth=2.2;
    G.beginPath();G.moveTo(x-18,y);G.lineTo(x+18,y);G.stroke();
  }
  G.restore();
}

/* tiny study props — book / notepad+pen / coffee — held up in front of the companion, cycling while mood is 'studying' */
/* head anchor per animal, matching each drawX()'s own head translate/radius so the cap sits right on top */
const HEAD_ANCHOR={
  panda:{dy:18,hs2:84,cy:0,r:84},
  fox:{dy:20,hs2:82,cy:-2,r:84},
  penguin:{dy:16,hs2:76,cy:-4,r:80},
  dog:{dy:18,hs2:86,cy:-2,r:88},
  cat:{dy:18,hs2:82,cy:-2,r:84}
};
/* graduation cap — earned once a course is finished with a good quiz score, stays on regardless of mood or idle time */
function drawGradCap(bob,anim,stageT,t){
  const HS=lerp(.95,.78,stageT);
  const P=HEAD_ANCHOR[anim]||HEAD_ANCHOR.panda;
  const headTopY=P.dy+HS*(P.cy-P.hs2-P.r);
  const cs=HS*1.45;
  G.save();G.translate(CX,CY+bob);
  G.translate(0,headTopY+7*HS);
  G.scale(cs,cs);
  E(0,13,25,7.5,0,'#161616','#000',1);
  G.beginPath();G.moveTo(-44,-3);G.lineTo(0,-16);G.lineTo(44,-3);G.lineTo(0,11);G.closePath();
  G.fillStyle='#1a1a1a';G.fill();G.strokeStyle='#000';G.lineWidth=1;G.stroke();
  C(0,-3,4,'#f5c542');
  const sway=Math.sin(t*.04)*5;
  G.strokeStyle='#f5c542';G.lineWidth=1.8;G.lineCap='round';
  G.beginPath();G.moveTo(0,-3);G.lineTo(sway,16);G.stroke();
  G.save();G.translate(sway,16);
  for(let i=-2;i<=2;i++){G.beginPath();G.moveTo(0,0);G.lineTo(i*2,8);G.strokeStyle='#f5c542';G.lineWidth=1.4;G.stroke();}
  G.restore();
  G.restore();
}

function drawStudyProp(bob,t,sub,subT){
  G.save();G.translate(CX,CY+bob);
  const y0=96;
  const swap=Math.min(1,subT/10);
  G.save();G.translate(0,y0);G.scale(swap,swap);
  if(sub===0){
    /* open book */
    const flip=Math.sin(t*.05)*.05;
    G.save();G.rotate(-.05);G.fillStyle='#fff8ec';G.strokeStyle='#d8c9a8';G.lineWidth=1.2;
    G.beginPath();G.moveTo(-2,-16);G.lineTo(-30,-19);G.lineTo(-30,17);G.lineTo(-2,14);G.closePath();G.fill();G.stroke();
    G.strokeStyle='#c9b48a';G.lineWidth=1;
    for(let i=0;i<3;i++){G.beginPath();G.moveTo(-26,-9+i*8);G.lineTo(-6,-10+i*8);G.stroke();}
    G.restore();
    G.save();G.rotate(.05+flip);G.fillStyle='#fff8ec';G.strokeStyle='#d8c9a8';G.lineWidth=1.2;
    G.beginPath();G.moveTo(2,-16);G.lineTo(30,-19);G.lineTo(30,17);G.lineTo(2,14);G.closePath();G.fill();G.stroke();
    G.strokeStyle='#c9b48a';G.lineWidth=1;
    for(let i=0;i<3;i++){G.beginPath();G.moveTo(6,-10+i*8);G.lineTo(26,-9+i*8);G.stroke();}
    G.restore();
    G.strokeStyle='#b08a4a';G.lineWidth=2;G.beginPath();G.moveTo(0,-17);G.lineTo(0,15);G.stroke();
  } else if(sub===1){
    /* notepad with pen actively writing */
    G.fillStyle='#eaf3ff';G.strokeStyle='#a8c8e8';G.lineWidth=1.4;
    G.beginPath();
    if(G.roundRect){G.roundRect(-24,-16,48,32,4);}else{G.rect(-24,-16,48,32);}
    G.fill();G.stroke();
    G.strokeStyle='#c3dcf3';G.lineWidth=1;
    for(let i=0;i<4;i++){G.beginPath();G.moveTo(-18,-8+i*7);G.lineTo(18,-8+i*7);G.stroke();}
    const prog=(Math.sin(t*.05)+1)/2;
    G.strokeStyle='#4a6fa5';G.lineWidth=1.6;G.beginPath();G.moveTo(-16,6);G.lineTo(-16+prog*30,6);G.stroke();
    const px=-16+prog*30,py=6+Math.sin(t*.4)*1.3;
    G.save();G.translate(px,py);G.rotate(-.6);
    G.fillStyle='#3a3a3a';G.fillRect(-2,-14,4,16);
    G.fillStyle='#f5c542';G.fillRect(-2,0,4,6);
    G.restore();
  } else {
    /* coffee cup with rising steam */
    G.save();G.strokeStyle='rgba(150,150,150,.55)';G.lineWidth=2;G.lineCap='round';
    [-1,1].forEach(i=>{
      const sx=i*7,sway=Math.sin(t*.05+i)*4;
      G.globalAlpha=.45+Math.sin(t*.07+i)*.2;
      G.beginPath();G.moveTo(sx,-14);G.quadraticCurveTo(sx+sway,-24,sx,-34-Math.sin(t*.06)*4);G.stroke();
    });
    G.restore();
    G.fillStyle='#f6f6f6';G.strokeStyle='#c9c9c9';G.lineWidth=1.5;
    G.beginPath();G.moveTo(-14,-12);G.lineTo(14,-12);G.lineTo(11,14);G.lineTo(-11,14);G.closePath();G.fill();G.stroke();
    G.fillStyle='#6b4226';G.beginPath();G.ellipse(0,-12,14,4,0,0,P2);G.fill();
    G.strokeStyle='#c9c9c9';G.lineWidth=2;G.beginPath();G.ellipse(15,0,6,8,0,-Math.PI/2,Math.PI/2);G.stroke();
  }
  G.restore();
  G.restore();
}

/* ═══════ PANDA ═══════ */
function drawPanda(m,bOpen,bob,br,tail,stageT,headTurn){
  stageT=stageT===undefined?1:stageT;
  const HS=lerp(.95,.78,stageT),ES=lerp(1.3,1.12,stageT),LT=lerp(.78,1.05,stageT),PT=lerp(1.2,1,stageT);
  G.save();G.translate(CX,CY+bob);
  shadow(0,126,64,14);
  limb(-32,108,22*PT,18*LT,-.15,'#1e1c1a','#0d0d0d',-32,122,15*PT,'#4a2e20','#2a1608');
  limb(32,108,22*PT,18*LT,.15,'#1e1c1a','#0d0d0d',32,122,15*PT,'#4a2e20','#2a1608');
  limb(-66,20+br,18*PT,30*LT,.22,'#1e1c1a','#0d0d0d',-66,46+br,15*PT,'#4a2e20','#2a1608');
  limb(66,20+br,18*PT,30*LT,-.22,'#1e1c1a','#0d0d0d',66,46+br,15*PT,'#4a2e20','#2a1608');
  const bg=G.createRadialGradient(-16,-10,8,0,68,90);bg.addColorStop(0,'#fafaf8');bg.addColorStop(1,'#edecea');
  E(0,72,58,66,0,bg,'#d8d5d0',2);
  E(0,80,34,44,0,'#ffffff');
  G.save();G.translate(0,18-HS*84);G.rotate(headTurn);G.scale(HS,HS);
  const hg=G.createRadialGradient(-20,-24,6,0,0,86);hg.addColorStop(0,'#ffffff');hg.addColorStop(1,'#eeeceb');
  C(0,0,84,hg);G.beginPath();G.arc(0,0,84,0,P2);G.strokeStyle='#d8d5d0';G.lineWidth=2;G.stroke();
  C(-74,-66,28,'#1e1c1a');C(74,-66,28,'#1e1c1a');C(-74,-66,17,'#2e2018');C(74,-66,17,'#2e2018');
  C(-30,-18,19,'#1e1c1a');C(30,-18,19,'#1e1c1a');
  drawEye(-30,-18,bOpen,m,'#4a3222','#1a0f08',ES*.86);drawEye(30,-18,bOpen,m,'#4a3222','#1a0f08',ES*.86);
  E(0,22,12,8.5,0,'#1e1c1a');C(-3,20,3.4,'rgba(255,255,255,.42)');
  drawMouth(0,37,m);
  blush(-60,17,19,12);blush(60,17,19,12);
  G.restore();
  G.restore();
}

/* ═══════ FOX ═══════ */
function drawFox(m,bOpen,bob,br,tail,stageT,headTurn){
  stageT=stageT===undefined?1:stageT;
  const HS=lerp(.95,.78,stageT),ES=lerp(1.3,1.12,stageT),LT=lerp(.78,1.05,stageT),PT=lerp(1.2,1,stageT);
  G.save();G.translate(CX,CY+bob);
  shadow(0,124,60,14);
  G.save();G.translate(64,56);G.rotate(tail*.68);
  E(0,0,20,52,-.1,'#c85c20');E(3,-28,16,30,0,'#d86828');E(5,-46,14,22,0,'#f5ece0');
  G.beginPath();G.ellipse(0,0,20,52,-.1,0,P2);G.strokeStyle='#9a3e10';G.lineWidth=1.5;G.stroke();
  G.restore();
  limb(-30,108,19*PT,15*LT,-.14,'#c85c20','#9a3e10',-30,122,14*PT,'#1e0c04','#3a1808');
  limb(30,108,19*PT,15*LT,.14,'#c85c20','#9a3e10',30,122,14*PT,'#1e0c04','#3a1808');
  limb(-62,22+br,15*PT,26*LT,.28,'#c85c20','#9a3e10',-62,46+br,13*PT,'#1e0c04','#3a1808');
  limb(62,22+br,15*PT,26*LT,-.28,'#c85c20','#9a3e10',62,46+br,13*PT,'#1e0c04','#3a1808');
  const bg=G.createRadialGradient(-10,40,5,0,68,75);bg.addColorStop(0,'#d86828');bg.addColorStop(1,'#b84e16');
  E(0,70,54,62,0,bg,'#9a3e10',2);E(0,76,30,40,0,'#f5ece0');
  G.save();G.translate(0,20-HS*82);G.rotate(headTurn);G.scale(HS,HS);
  const hg=G.createRadialGradient(-16,-18,5,0,-2,84);hg.addColorStop(0,'#dd7030');hg.addColorStop(1,'#c05018');
  C(0,-2,84,hg);G.beginPath();G.arc(0,-2,84,0,P2);G.strokeStyle='#9a3e10';G.lineWidth=2;G.stroke();
  T3([[-62,-64],[-94,-112],[-18,-74]],'#c85c20','#9a3e10',1.5);T3([[62,-64],[94,-112],[18,-74]],'#c85c20','#9a3e10',1.5);
  T3([[-58,-68],[-82,-104],[-20,-76]],'#F4C0D1');T3([[58,-68],[82,-104],[20,-76]],'#F4C0D1');
  E(-60,4,25,34,-.2,'#f5ece0');E(60,4,25,34,.2,'#f5ece0');E(0,20,46,36,0,'#f5ece0');
  drawEye(-32,-22,bOpen,m,'#3a1c08','#1a0804',ES);drawEye(32,-22,bOpen,m,'#3a1c08','#1a0804',ES);
  E(0,14,10,7.5,0,'#1a0c04');C(-2.5,13,3.2,'rgba(255,255,255,.45)');
  drawMouth(0,28,m);blush(-58,14,18,12);blush(58,14,18,12);
  G.restore();
  G.restore();
}

/* ═══════ PENGUIN ═══════ */
function drawPenguin(m,bOpen,bob,br,tail,stageT,headTurn){
  stageT=stageT===undefined?1:stageT;
  const HS=lerp(.95,.78,stageT),ES=lerp(1.3,1.12,stageT),PT=lerp(1.2,1,stageT);
  G.save();G.translate(CX,CY+bob);
  shadow(0,122,52,13);
  E(-22,116,19*PT,12*PT,.2,'#e8920a','#c07008',1.5);E(22,116,19*PT,12*PT,-.2,'#e8920a','#c07008',1.5);
  toeDots(-22,124,10*PT,'#c07008',3);toeDots(22,124,10*PT,'#c07008',3);
  G.save();G.rotate(tail*.4+.06);E(-58,16,14,38,-.12,'#1e2230','#10121a',2);G.restore();
  G.save();G.rotate(-tail*.4-.06);E(58,16,14,38,.12,'#1e2230','#10121a',2);G.restore();
  const bg=G.createRadialGradient(-8,32,4,0,66,74);bg.addColorStop(0,'#282c3e');bg.addColorStop(1,'#181c2c');
  E(0,68,50,62,0,bg,'#10121a',2);E(0,74,32,46,0,'#f5f5f3');
  G.save();G.translate(0,16-HS*76);G.rotate(headTurn);G.scale(HS,HS);
  const hg=G.createRadialGradient(-12,-18,4,0,-4,80);hg.addColorStop(0,'#2a2e42');hg.addColorStop(1,'#181c2c');
  C(0,-4,80,hg);G.beginPath();G.arc(0,-4,80,0,P2);G.strokeStyle='#10121a';G.lineWidth=2;G.stroke();
  E(0,4,58,62,0,'#f5f5f3');
  drawEye(-26,-14,bOpen,m,'#1e2230','#0a0c14',ES);drawEye(26,-14,bOpen,m,'#1e2230','#0a0c14',ES);
  E(0,30,20,15,0,'#e8920a','#c07008',1.5);drawBeak(0,30,m);
  blush(-48,14,15,10);blush(48,14,15,10);
  G.restore();
  G.restore();
}

/* ═══════ DOG ═══════ */
function drawDog(m,bOpen,bob,br,tail,stageT,headTurn){
  stageT=stageT===undefined?1:stageT;
  const HS=lerp(.95,.78,stageT),ES=lerp(1.3,1.12,stageT),LT=lerp(.78,1.05,stageT),PT=lerp(1.2,1,stageT);
  G.save();G.translate(CX,CY+bob);
  shadow(0,124,62,14);
  G.save();G.translate(60,18);G.rotate(tail*2.2);E(0,-6,10,36,-.1,'#c8903a');E(0,-34,8,17,0,'#dab050');G.restore();
  limb(-32,106,20*PT,16*LT,-.12,'#c8903a','#906020',-32,120,15*PT,'#4a2c10','#2c1808');
  limb(32,106,20*PT,16*LT,.12,'#c8903a','#906020',32,120,15*PT,'#4a2c10','#2c1808');
  limb(-64,24+br,16*PT,28*LT,.28,'#c8903a','#906020',-64,50+br,14*PT,'#4a2c10','#2c1808');
  limb(64,24+br,16*PT,28*LT,-.28,'#c8903a','#906020',64,50+br,14*PT,'#4a2c10','#2c1808');
  const bg=G.createRadialGradient(-14,32,5,0,68,78);bg.addColorStop(0,'#e4bc50');bg.addColorStop(1,'#c09030');
  E(0,70,56,64,0,bg,'#b08028',2);E(0,76,32,42,0,'#e8c060');
  G.save();G.translate(0,18-HS*86);G.rotate(headTurn);G.scale(HS,HS);
  const hg=G.createRadialGradient(-20,-20,6,0,-2,88);hg.addColorStop(0,'#ecc040');hg.addColorStop(1,'#c89030');
  C(0,-2,88,hg);G.beginPath();G.arc(0,-2,88,0,P2);G.strokeStyle='#b08028';G.lineWidth=2;G.stroke();
  E(-84,20,20,48,.22,'#b07828','#906020',2);E(-84,20,14,36,.18,'#c8983a');E(84,20,20,48,-.22,'#b07828','#906020',2);E(84,20,14,36,-.18,'#c8983a');
  E(0,-24,60,46,0,'#e8c050');E(0,24,48,36,0,'#e8c860','#c8a038',1.5);
  drawEye(-32,-20,bOpen,m,'#2c1808','#100602',ES);drawEye(32,-20,bOpen,m,'#2c1808','#100602',ES);
  E(0,16,17,12,0,'#1a0c06');E(0,16,11,7.5,0,'#281410');C(-3,14,3.4,'rgba(255,255,255,.48)');
  drawMouth(0,36,m);
  if(m==='happy'||m==='excited'||m==='celebrating'){G.save();G.fillStyle='#ff7096';E(0,46,9,9,0,'#ff7096');G.strokeStyle='#e0507a';G.lineWidth=2;G.beginPath();G.moveTo(0,39);G.lineTo(0,53);G.stroke();G.restore();}
  blush(-62,18,18,12);blush(62,18,18,12);
  G.restore();
  G.restore();
}

/* ═══════ CAT ═══════ */
function drawCat(m,bOpen,bob,br,tail,stageT,headTurn){
  stageT=stageT===undefined?1:stageT;
  const HS=lerp(.95,.78,stageT),ES=lerp(1.3,1.12,stageT),LT=lerp(.78,1.05,stageT),PT=lerp(1.2,1,stageT);
  G.save();G.translate(CX,CY+bob);
  shadow(0,122,56,13);
  G.save();G.translate(54,48);G.rotate(.55+tail*.62);
  E(0,0,13,40,0,'#b0a090','#98887a',1.3);
  E(2,-28,10.5,24,0,'#c3b6a2');
  E(3,-48,8.5,15,0,'#f0ece4');
  G.restore();
  limb(-28,106,18*PT,15*LT,-.1,'#b0a090','#7a6858',-28,120,13*PT,'#7a6858','#4a3c2e');
  limb(28,106,18*PT,15*LT,.1,'#b0a090','#7a6858',28,120,13*PT,'#7a6858','#4a3c2e');
  limb(-58,20+br,14*PT,26*LT,.26,'#b0a090','#7a6858',-58,44+br,12*PT,'#7a6858','#4a3c2e');
  limb(58,20+br,14*PT,26*LT,-.26,'#b0a090','#7a6858',58,44+br,12*PT,'#7a6858','#4a3c2e');
  const bg=G.createRadialGradient(-10,32,4,0,66,70);bg.addColorStop(0,'#cbbba8');bg.addColorStop(1,'#a89888');
  E(0,68,52,62,0,bg,'#988878',2);E(0,74,28,40,0,'#f0ece4');
  G.save();G.strokeStyle='#988878';G.lineWidth=2.2;G.globalAlpha=.38;G.lineCap='round';[[-12,32],[0,28],[12,32]].forEach(([dx,dy])=>{G.beginPath();G.moveTo(dx-6,dy-6);G.quadraticCurveTo(dx,dy+6,dx+6,dy-6);G.stroke();});G.restore();
  G.save();G.translate(0,18-HS*82);G.rotate(headTurn);G.scale(HS,HS);
  const hg=G.createRadialGradient(-16,-18,5,0,-2,84);hg.addColorStop(0,'#cbbba8');hg.addColorStop(1,'#a89888');
  C(0,-2,84,hg);G.beginPath();G.arc(0,-2,84,0,P2);G.strokeStyle='#988878';G.lineWidth=2;G.stroke();
  T3([[-62,-58],[-90,-106],[-14,-70]],'#b0a090','#988878',1.5);T3([[62,-58],[90,-106],[14,-70]],'#b0a090','#988878',1.5);
  T3([[-58,-62],[-78,-98],[-16,-72]],'#ffccd5');T3([[58,-62],[78,-98],[16,-72]],'#ffccd5');
  G.save();G.strokeStyle='#988878';G.lineWidth=2;G.globalAlpha=.4;G.lineCap='round';[[-8,-60],[0,-64],[8,-60]].forEach(([dx,dy])=>{G.beginPath();G.moveTo(dx-5,dy);G.lineTo(dx+5,dy+12);G.stroke();});G.restore();
  E(0,20,44,34,0,'#f0ece4');
  G.save();G.strokeStyle='#c0b8a8';G.lineWidth=1.7;G.globalAlpha=.88;G.lineCap='round';[[-50,13,-18,17],[-50,22,-18,22],[-50,31,-20,26],[18,17,50,13],[18,22,50,22],[20,26,50,31]].forEach(([x1,y1,x2,y2])=>{G.beginPath();G.moveTo(x1,y1);G.lineTo(x2,y2);G.stroke();});G.restore();
  drawEye(-30,-16,bOpen,m,'#2c7022','#163a10',ES);drawEye(30,-16,bOpen,m,'#2c7022','#163a10',ES);
  T3([[0,14],[-8,22],[8,22]],'#ffb3c6');
  drawMouth(0,28,m);blush(-54,14,16,10);blush(54,14,16,10);
  G.restore();
  G.restore();
}

const DFN={panda:drawPanda,fox:drawFox,penguin:drawPenguin,dog:drawDog,cat:drawCat};
const GROUND_OFF={panda:126,fox:124,penguin:122,dog:124,cat:122};

function skyGrad(c0,c1){const g=G.createLinearGradient(0,0,0,H);g.addColorStop(0,c0);g.addColorStop(1,c1);return g;}

/* ═══════ PANDA — bamboo forest ═══════ */
function sceneBamboo(t){
  G.fillStyle=skyGrad('#eafaf0','#cdeecb');G.fillRect(0,0,W,H);
  G.fillStyle='#bfe3a8';G.fillRect(0,H-56,W,56);
  G.fillStyle='#aed99a';G.fillRect(0,H-56,W,8);
  const sway=Math.sin(t*.015)*3;
  [[26,170,15],[54,140,12],[8,120,10],[264,190,16],[292,150,13],[308,120,10]].forEach(([x,h,w],i)=>{
    const sw=sway*(i%2?1:-1);
    G.save();G.translate(x,H-56);
    G.fillStyle='#8fc95a';G.strokeStyle='#6ea83a';G.lineWidth=1.4;
    G.beginPath();G.moveTo(-w/2,0);G.quadraticCurveTo(-w/2+sw,-h*.5,sw*.6,-h);G.quadraticCurveTo(w/2+sw,-h*.5,w/2,0);G.closePath();G.fill();G.stroke();
    for(let j=1;j<4;j++){G.beginPath();G.moveTo(-w/2+sw*j/4,-h*j/4);G.lineTo(w/2+sw*j/4,-h*j/4);G.stroke();}
    E(sw*.6-7,-h+6,10,5,-.4,'#7ec25a');E(sw*.6+7,-h+3,10,5,.5,'#8fd06a');
    G.restore();
  });
  G.save();G.globalAlpha=.4;
  [[70,60,4],[250,90,3],[100,40,3]].forEach(([x,y,r])=>C(x,y,r,'#e7f8dc'));
  G.restore();
  G.save();G.globalAlpha=.8;G.fillStyle='#fff';
  [[64,44,t*.06],[190,32,t*.05],[236,68,t*.07]].forEach(([x0,y,spd])=>{
    const x=((x0+spd)%(W+60))-30;
    C(x,y,13,'#fff');C(x+15,y+4,10,'#fff');C(x-13,y+4,10,'#fff');
  });
  G.restore();
}

/* ═══════ FOX — autumn forest ═══════ */
function sceneAutumn(t){
  G.fillStyle=skyGrad('#fff3e0','#ffd7a3');G.fillRect(0,0,W,H);
  G.fillStyle='#e8b878';G.fillRect(0,H-52,W,52);
  function tree(x,r,c1,c2){
    G.fillStyle='#8a5a3c';G.fillRect(x-5,H-56,10,40);
    C(x,H-92,r,c1);C(x-r*.5,H-78,r*.7,c2);C(x+r*.5,H-78,r*.7,c2);
  }
  tree(38,30,'#e0742c','#f0954a');
  tree(284,26,'#c0392b','#e0603c');
  for(let i=0;i<7;i++){
    const fy=((i*53+t*.6)%(H+20))-10;
    const fx=(i*47)%W+Math.sin(t*.02+i)*10;
    G.save();G.translate(fx,fy);G.rotate(t*.02+i);G.globalAlpha=.85;
    G.fillStyle=['#e0742c','#c0392b','#f0954a'][i%3];
    G.beginPath();G.ellipse(0,0,4,2.4,0,0,P2);G.fill();
    G.restore();
  }
}

function sceneMountainDen(t){
  G.fillStyle=skyGrad('#dce7f0','#eef4f7');G.fillRect(0,0,W,H);
  G.fillStyle='#b9c9d6';
  G.beginPath();G.moveTo(0,170);G.lineTo(60,110);G.lineTo(120,160);G.lineTo(190,90);G.lineTo(260,150);G.lineTo(320,120);G.lineTo(320,220);G.lineTo(0,220);G.closePath();G.fill();
  G.fillStyle='#9fb3c4';
  G.beginPath();G.moveTo(0,210);G.lineTo(80,140);G.lineTo(150,200);G.lineTo(230,130);G.lineTo(320,190);G.lineTo(320,250);G.lineTo(0,250);G.closePath();G.fill();
  function pine(x,h,w,c){
    G.fillStyle=c;
    for(let i=0;i<3;i++){
      const yTop=H-70-h+(i*h/3.4),ww=w*(1-i*.22);
      G.beginPath();G.moveTo(x,yTop);G.lineTo(x-ww/2,yTop+h/2.6);G.lineTo(x+ww/2,yTop+h/2.6);G.closePath();G.fill();
    }
    G.fillStyle='#5a3a24';G.fillRect(x-3,H-74,6,10);
  }
  pine(28,80,34,'#3f5c46');
  pine(54,58,26,'#4d7052');
  pine(292,90,38,'#375647');
  pine(310,58,26,'#4d7052');
  G.fillStyle='#a99383';G.fillRect(0,H-64,W,64);
  G.fillStyle='#8f7c6d';G.beginPath();G.ellipse(160,H-64,220,26,0,Math.PI,0);G.fill();
  [[46,H-30,13],[96,H-18,10],[236,H-22,11],[268,H-14,9]].forEach(([x,y,r])=>{
    C(x,y,r,'#8c7c6d');C(x-r*.3,y-r*.3,r*.4,'#a4917f');
  });
  G.save();
  G.fillStyle='#5a4736';G.beginPath();G.ellipse(250,H-56,34,26,0,0,P2);G.fill();
  const dg=G.createRadialGradient(250,H-56,4,250,H-56,30);
  dg.addColorStop(0,'#1b140d');dg.addColorStop(1,'#3c2e20');
  G.fillStyle=dg;G.beginPath();G.ellipse(250,H-56,26,20,0,0,P2);G.fill();
  G.restore();
  [[224,H-42,8],[276,H-42,9],[250,H-76,7]].forEach(([x,y,r])=>C(x,y,r,'#948270'));
  for(let i=0;i<3;i++){
    const fx=((i*140+t*.25)%(W+120))-60;
    const fy=120+i*30+Math.sin(t*.01+i)*6;
    G.save();G.globalAlpha=.16;E(fx,fy,70,16,0,'#ffffff');G.restore();
  }
}

function snowflake(x,y,r,a){
  G.save();G.translate(x,y);G.rotate(a);G.fillStyle='#ffffff';
  G.beginPath();
  G.moveTo(0,-r);G.quadraticCurveTo(r*.18,-r*.18,r,0);
  G.quadraticCurveTo(r*.18,r*.18,0,r);
  G.quadraticCurveTo(-r*.18,r*.18,-r,0);
  G.quadraticCurveTo(-r*.18,-r*.18,0,-r);
  G.closePath();G.fill();
  G.save();G.rotate(Math.PI/4);G.globalAlpha*=.8;const r2=r*.62;
  G.beginPath();
  G.moveTo(0,-r2);G.quadraticCurveTo(r2*.18,-r2*.18,r2,0);
  G.quadraticCurveTo(r2*.18,r2*.18,0,r2);
  G.quadraticCurveTo(-r2*.18,r2*.18,-r2,0);
  G.quadraticCurveTo(-r2*.18,-r2*.18,0,-r2);
  G.closePath();G.fill();
  G.restore();
  G.restore();
}

/* ═══════ PENGUIN — snowy landscape ═══════ */
function sceneSnow(t){
  G.fillStyle=skyGrad('#eaf6ff','#d3ecfb');G.fillRect(0,0,W,H);
  G.fillStyle='#e3f2fb';G.beginPath();G.ellipse(90,H-40,140,50,0,Math.PI,0);G.fill();
  G.fillStyle='#ffffff';G.beginPath();G.ellipse(232,H-30,160,46,0,Math.PI,0);G.fill();
  G.fillStyle='#f5fbff';G.fillRect(0,H-30,W,30);
  for(let i=0;i<12;i++){
    const fy=((i*41+t*.5)%(H+20))-10;
    const fx=(i*67)%W+Math.sin(t*.02+i)*8;
    const r=i%3===0?3.4:2.2;
    G.save();G.globalAlpha=.95;snowflake(fx,fy,r,t*.01+i);G.restore();
  }
}

/* ═══════ DOG — park ═══════ */
function scenePark(t){
  G.fillStyle=skyGrad('#bfe3fb','#eaf7ff');G.fillRect(0,0,W,H-70);
  G.save();G.globalAlpha=.85;C(266,46,22,'#ffe38a');G.globalAlpha=.35;C(266,46,32,'#fff3c0');G.restore();
  G.save();G.globalAlpha=.85;G.fillStyle='#fff';
  [[60,50],[110,62],[160,42]].forEach(([x,y])=>{C(x,y,14,'#fff');C(x+16,y+4,11,'#fff');C(x-14,y+4,11,'#fff');});
  G.restore();
  G.fillStyle='#a9de84';G.fillRect(0,H-70,W,70);
  G.fillStyle='#96cf72';G.fillRect(0,H-70,W,10);
  G.fillStyle='#8a5a3c';G.fillRect(268,H-100,10,42);
  C(273,H-118,28,'#6fbf5a');C(255,H-108,20,'#7fcf68');C(291,H-108,20,'#7fcf68');
  function flower(x,y,c,r){
    for(let k=0;k<5;k++){
      const a=k*(P2/5);
      C(x+Math.cos(a)*r,y+Math.sin(a)*r,r*.72,c);
    }
    C(x,y,r*.55,'#fff6b0');
  }
  [[40,H-24,'#ff9fc7'],[90,H-14,'#ffe38a'],[190,H-20,'#a3d9ff'],[230,H-10,'#ff9fc7'],
   [130,H-30,'#ffb3d6'],[65,H-8,'#fff0a0'],[250,H-30,'#b8e3ff']].forEach(([x,y,c])=>flower(x,y,c,3.4));
}

/* ═══════ CAT — cozy bedroom ═══════ */
function sceneBedroom(t){
  G.fillStyle=skyGrad('#f6e9df','#f0dbe6');G.fillRect(0,0,W,H);
  G.strokeStyle='#e2c9d0';G.lineWidth=2;G.beginPath();G.moveTo(0,H-90);G.lineTo(W,H-90);G.stroke();
  G.fillStyle='#2b2d52';G.fillRect(230,30,66,80);
  G.strokeStyle='#caa06a';G.lineWidth=5;G.strokeRect(230,30,66,80);
  G.strokeStyle='#caa06a';G.lineWidth=3;G.beginPath();G.moveTo(263,30);G.lineTo(263,110);G.moveTo(230,70);G.lineTo(296,70);G.stroke();
  C(280,50,7,'#fdf6d8');
  [[240,45],[250,90],[286,95]].forEach(([x,y])=>{G.save();G.globalAlpha=.5+Math.sin(t*.05+x)*.3;C(x,y,1.4,'#fff');G.restore();});
  G.fillStyle='rgba(214,150,170,.55)';
  G.beginPath();G.moveTo(222,20);G.quadraticCurveTo(232,70,224,118);G.lineTo(214,118);G.quadraticCurveTo(220,70,212,20);G.closePath();G.fill();
  G.beginPath();G.moveTo(304,20);G.quadraticCurveTo(294,70,302,118);G.lineTo(312,118);G.quadraticCurveTo(306,70,314,20);G.closePath();G.fill();
  G.fillStyle='#c9946a';G.fillRect(20,60,54,8);
  C(30,54,10,'#6fae5c');G.fillStyle='#8a5a3c';G.fillRect(26,58,8,10);
  G.fillStyle='#caa06a';G.fillRect(0,H-30,W,30);
  G.save();G.globalAlpha=.85;E(160,H-16,80,12,0,'#e3a6b8');G.restore();
  for(let i=0;i<6;i++){
    const x=20+i*56,y=14+Math.sin(t*.03+i)*3;
    G.save();G.globalAlpha=.6+Math.sin(t*.06+i)*.3;C(x,y,3,'#ffe38a');G.restore();
  }
}

const SCENES={panda:sceneBamboo,fox:sceneMountainDen,penguin:sceneSnow,dog:scenePark,cat:sceneBedroom};

function drawBG(m){
  if(m==='celebrating'){
    G.save();
    ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#ff6bb5'].forEach((c,i)=>{
      const a=(i/6)*P2+sparkT*.7,r=108+Math.sin(sparkT+i)*16;
      G.globalAlpha=.4+Math.sin(sparkT*2+i)*.18;G.fillStyle=c;
      G.beginPath();G.arc(CX+Math.cos(a)*r,CY+Math.sin(a)*r*.5-20,6,0,P2);G.fill();
    });
    ['♥','♥','♥','♥'].forEach((h,i)=>{
      const hx=[-90,-60,60,90][i],hy=[-70,-40,-50,-75][i];
      G.globalAlpha=.55+Math.sin(T*.05+i)*.3;G.fillStyle=['#ff6b9d','#ff8fab'][i%2];
      G.font=`${16+i*2}px serif`;G.fillText(h,CX+hx,CY+hy+Math.sin(T*.04+i)*12);
    });
    G.restore();
  }
  if(m==='excited'){
    G.save();
    ['#ffd93d','#ff6b6b','#6bcb77','#4d96ff'].forEach((c,i)=>{
      const a=(i/4)*P2+sparkT,r=90+Math.sin(sparkT*1.5+i)*20;
      G.globalAlpha=.5;G.fillStyle=c;
      G.beginPath();G.moveTo(CX+Math.cos(a)*r,CY+Math.sin(a)*r*.5-20);
      for(let j=1;j<=5;j++){const a2=a+j*P2*2/5;G.lineTo(CX+Math.cos(a2)*(r*.4),CY+Math.sin(a2)*(r*.4)*.5-20);G.lineTo(CX+Math.cos(a+j*P2/5)*r,CY+Math.sin(a+j*P2/5)*r*.5-20);}
      G.closePath();G.fill();
    });
    G.restore();
  }
  if(m==='sleeping'){
    G.save();G.fillStyle='#7F77DD';const o=Math.sin(zzP)*8;
    G.globalAlpha=.6;G.font='bold 13px sans-serif';G.fillText('z',CX+62,CY-92+o);
    G.globalAlpha=.7;G.font='bold 17px sans-serif';G.fillText('z',CX+78,CY-116+o*.72);
    G.globalAlpha=.8;G.font='bold 22px sans-serif';G.fillText('Z',CX+94,CY-146+o*.44);
    G.globalAlpha=.4;G.font='20px serif';G.fillText('🌙',CX+62,CY-155);
    G.restore();
  }
  if(m==='angry'){
    G.save();G.strokeStyle='#ff5252';G.lineWidth=3.2;G.globalAlpha=.58;G.lineCap='round';
    for(let i=0;i<4;i++){const ax=CX-54+i*36,ay=CY-158+Math.sin(T*.1+i)*6;G.beginPath();G.moveTo(ax,ay);G.lineTo(ax+10,ay-24);G.stroke();}G.restore();
  }
  if(m==='sad'){
    G.save();G.globalAlpha=.22;
    const rg=G.createRadialGradient(CX,CY,10,CX,CY,130);rg.addColorStop(0,'transparent');rg.addColorStop(1,'#aad4ff');
    G.fillStyle=rg;G.fillRect(0,0,W,H);G.restore();
  }
  conf=conf.filter(c=>c.l>0);
  conf.forEach(c=>{c.x+=c.vx;c.y+=c.vy;c.vy+=.26;c.l-=c.d;c.r+=.07;G.save();G.globalAlpha=c.l;G.fillStyle=c.c;G.translate(c.x,c.y);G.rotate(c.r);G.fillRect(-c.s/2,-c.s/2,c.s,c.s);G.restore();});
}

function loop(){
  T++;sparkT+=.09;zzP+=.046;
  bT++;if(bT>=nB){bP+=.23;if(bP>=1){bP=0;bT=0;nB=92+Math.random()*92;}}
  const bRaw=bP<.5?bP*2:2-bP*2;
  const m=forced||AMOOD(prog,idleDays);
  const bOpen=m==='sleeping'?0:1-bRaw;
  const spd=m==='celebrating'?.24:m==='excited'?.16:.052;
  const amp=m==='celebrating'?12:m==='excited'?8:3.5;
  bobY=Math.sin(T*spd)*amp;
  breathT+=m==='sleeping'?.022:.05;const br=Math.sin(breathT)*3.8;
  tailT+=m==='happy'||m==='excited'||m==='celebrating'?.16:m==='angry'?.1:.03;
  const tamp=m==='celebrating'?.70:m==='happy'||m==='excited'?.48:m==='angry'?.28:.09;
  const tail=Math.sin(tailT)*tamp;
  if(m==='celebrating'&&conf.length<6)spawnConf();
  if(m!=='celebrating')conf=[];
  // SCALE: continuous (gradual) from progress, not bucketed by STAGES[].s.
  // STAGES[].s is still used for the display name ("Baby", "Adult", etc.) and
  // for the per-feature lerps inside drawX(), but the global canvas scale
  // tracks progress directly so the companion grows smoothly as progress
  // increases (e.g. at p=50% the canvas scale is 0.71, not a discrete 0.68
  // jump that looked nearly adult-sized too early).
  const stageT=Math.min(1,Math.max(0,prog/100));
  const sc = 0.42 + 0.58 * stageT;
  headTurnT+=.006;
  const htAmp=m==='sleeping'?.02:.11;
  headTurn=Math.sin(headTurnT)*htAmp;
  G.clearRect(0,0,W,H);
  if (!SCENES[animal]) {
    animal = 'panda';
  }
  SCENES[animal](T);
  drawBG(m);
  const gy=CY+GROUND_OFF[animal];
  G.save();G.translate(CX*(1-sc),gy*(1-sc));G.scale(sc,sc);
  if (!DFN[animal]) {
    animal = 'panda';
  }
  DFN[animal](m,bOpen,bobY,br,tail,stageT,headTurn);
  if(m==='studying'){
    const idleF=T-lastProgFrame;
    const onBreak=idleF>240;
    const desired=onBreak?2:(Math.floor(T/220)%2);
    if(desired!==studySub){studySub=desired;studySubT=0;refresh();}
    studySubT++;
    drawStudyProp(bobY,T,studySub,studySubT);
  }
  G.restore();
  }

/* React-facing interface ---- */

let _animal = opts.animal || 'panda';
let _mood   = opts.mood   || null;
let _prog   = typeof opts.prog === 'number' ? opts.prog : 0;
let _idle   = typeof opts.idle === 'number' ? opts.idle : 0;
let _quiz   = typeof opts.quiz === 'number' ? opts.quiz : 60;
let _running = false;
let _rafId = null;

function step() {
  // Defensive: if backend sends a value not in the prototype's animal set,
  // fall back to 'panda' so we at least render something.
  if (SCENES[_animal] === undefined) {
    _animal = 'panda';
  }
  animal = _animal;
  if (_mood) forced = _mood; else forced = null;
  prog = _prog;
  idleDays = _idle;
  quizScore = _quiz;
  loop();
  if (_running) _rafId = requestAnimationFrame(step);
}

return {
  setAnimal(a) { _animal = a; },
  setMood(m)   { _mood = m; },
  setProg(p)   { _prog = p; },
  setIdle(i)   { _idle = i; },
  setQuiz(q)   { _quiz = q; },
  start() {
    if (_running) return;
    _running = true;
    _rafId = requestAnimationFrame(step);
  },
  stop() {
    _running = false;
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  },
};
}

