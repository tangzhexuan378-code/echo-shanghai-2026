(() => {
  'use strict';
  const enabled = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!enabled) return;
  let send, data, state, screen = '', overlay, stick, look, action;
  let stickId = null, lookId = null, holdId = null, lastPoint, padMode = '';
  const refs = {};
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function add(parent, tag, cls, text) { const node=el(tag,cls,text); parent.append(node); return node; }
  function button(parent, text, cmd, value, cls='') {
    const b = add(parent,'button',cls,text);
    b.type = 'button'; b.dataset.command=cmd;
    b.onclick=()=>send(cmd,value??0);
    return b;
  }
  function setText(node, text) { if (node.textContent !== String(text)) node.textContent = text; }
  function release() {
    stickId = lookId = holdId = null;
    if (stick) stick.style.setProperty('--knob','translate(0px,0px)');
    if (send) send('reset');
  }
  const help = s => String(s||'').replace(/按住 E/g,'按住互动键').replace(/松手/g,'松开').replace(/按 E/g,'点互动').replace(/E\s{2,}/g,'互动 · ').replace(/方向键/g,'屏幕方向键').replace(/转动鼠标/g,'滑动右侧画面').replace(/按空格/g,'点跳跃').replace(/按 R 前往下一处上海地点/g,'从菜单选择「换上海地点」').replace(/Tab\s+返回剧情列表/g,'从菜单打开「剧情列表」').replace(/走到蓝色槽口/g,'走到蓝色槽口');
  const legacy = {route:'依次走进发光脚印。',place:'靠近物件点互动拿起，再走到蓝色槽口点互动放下。',pulse:'靠近装置，在光环重合时点互动。',align:'走进圆心，滑动右侧画面让双环对齐，点互动固定。'};
  function page(title, caption) {
    const panel=add(overlay,'section','touch-sheet');
    const content=add(panel,'div','touch-content');
    if(caption) add(content,'small','kicker',caption);
    add(content,'h1','',title); return content;
  }
  function home() {
    const c=page('回到同一处','E C H O   /   上海 2026');
    add(c,'p','intro','回到童年亲手试一次，再决定今天怎么做。');
    const start=add(c,'div','menu-actions');
    button(start,'随机开始','quick',0,'gold');
    button(start,'选择剧情','catalog');
    add(c,'p','gesture-hint','左手拖摇杆走动，右手滑动画面转向。靠近物件后点「互动」。');
    const details=add(c,'details','identity');
    add(details,'summary','','自由探索与身份');
    const controls=add(details,'div','identity-input');
    ['adult','child'].forEach((key,i)=>{
      const label=add(controls,'label','',i?'童年身份':'成年身份');
      const select=add(label,'select'); refs[key]=select;
      data.roles.forEach((r,k)=>{const opt=add(select,'option','',r[i]);opt.value=k;});
      select.onchange=()=>send(key,Number(select.value));
    });
    button(controls,'随机身份','pair');
    button(controls,'进入上海','free',0,'gold');
    button(c,'体验「握松一点」','sample',0,'text-button');
  }
  function catalog() {
    const c=page('30 段回声','剧情目录');
    const nav=add(c,'div','menu-actions');button(nav,'推荐路线','recommend',0,'gold');button(nav,'首页','home');
    const list=add(c,'div','story-list');
    data.stories.forEach((v,i)=>button(list,String(i+1).padStart(2,'0')+'　'+v+(state.done?.includes(String(i+1))?'　✓':''),'story',i+1));
  }
  function pause() {
    const c=page('暂停',state.place);
    const nav=add(c,'div','menu-actions');
    button(nav,'继续游戏','pause',0,'gold');button(nav,'换一组场景和互动','quick');
    button(nav,'剧情列表','catalog');button(nav,'回声图鉴','archive');
    if(!state.story && state.age==='adult') button(nav,'换上海地点','district');
    refs.sound=button(nav,'声音','audio');button(nav,'回到首页','home');
  }
  function archive() {
    const c=page('回声图鉴','自由探索');
    button(c,'返回现场','archive');
    if(!state.entries.length) add(c,'p','intro','在自由探索中完成一段回声后，可以在这里重读。');
    state.entries.forEach(([id,title])=>button(c,title,'read',id));
  }
  function result() {
    const r=state.record,c=page(r.title,'回声记录  /  '+r.place);
    const actions=add(c,'div','menu-actions');
    button(actions,'关闭记录','dismiss',0,'gold');
    if(state.retry) button(actions,'回现场再试','retry');
    for(const [key,title] of [['adult','今天的现场'],['child','想起的往事'],['bridge','留下的经验'],['result','你选择了「'+r.action+'」']]){
      add(c,'h2','',title);add(c,'p','record-text',r[key]);
    }
    const foot=add(c,'div','menu-actions');
    if(state.story && state.chapter===30){
      button(foot,'试听当前版','listen');
      if(state.saved)add(foot,'p','','两版录音均已保存');
      else if(state.tapes===3)button(foot,'两版都保存','both');
    }
    if(state.quick)button(foot,'下一段随机回声','quick');
    if(state.story && !state.quick && state.chapter!==30)button(foot,'继续推荐路线','recommend');
    button(foot,'剧情列表','catalog');
  }
  function play() {
    look=add(overlay,'div','look-area');look.id='touch-look';look.setAttribute('aria-label','滑动转动视角');
    look.onpointerdown=e=>{
      if(lookId!==null)return;
      lookId=e.pointerId;lastPoint=[e.clientX,e.clientY];look.setPointerCapture(lookId);
    };
    look.onpointermove=e=>{
      if(e.pointerId!==lookId)return;
      send('look',e.clientX-lastPoint[0],e.clientY-lastPoint[1]);lastPoint=[e.clientX,e.clientY];
    };
    look.onlostpointercapture=()=>{lookId=null;};
    const header=add(overlay,'div','game-bar');
    const location=add(header,'div','location');refs.place=add(location,'strong');refs.name=add(location,'span');
    refs.view=button(header,'视角','view');
    button(header,'菜单','pause');
    const info=add(overlay,'div','game-info');
    const row=add(info,'div','task-summary');
    refs.task=add(row,'strong');refs.notes=add(row,'button','','详情');refs.notes.type='button';
    refs.read=add(info,'div','details');refs.read.hidden=true;
    refs.notes.onclick=()=>{refs.read.hidden=!refs.read.hidden;};
    refs.rule=add(info,'div','rule');
    refs.status=add(info,'div','trial-status');
    refs.meter=add(info,'progress','beat');
    refs.meter.max=1;
    refs.bearing=add(overlay,'div','bearing');
    const bottom=add(overlay,'div','touch-bottom');
    stick=add(bottom,'div','stick');stick.id='touch-stick';stick.setAttribute('aria-label','移动摇杆');
    add(stick,'span','stick-knob');
    const move=e=>{
      const rect=stick.getBoundingClientRect();
      const dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2);
      const radius=rect.width*.35, divisor=Math.max(radius,Math.hypot(dx,dy));
      stick.style.setProperty('--knob','translate('+(dx/divisor*radius)+'px,'+(dy/divisor*radius)+'px)');
      send('move',dx/divisor,dy/divisor);
    };
    stick.onpointerdown=e=>{if(stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(stickId);move(e);};
    stick.onpointermove=e=>{if(stickId===e.pointerId)move(e);};
    stick.onlostpointercapture=()=>{stickId=null;stick.style.setProperty('--knob','translate(0px,0px)');send('move',0,0);};
    const actions=add(bottom,'div','hand');
    refs.near=button(actions,'走近目标','approach');
    button(actions,'跳跃','jump');
    action=add(actions,'button','gold interact','互动');action.type='button';action.id='touch-action';
    action.onpointerdown=e=>{if(holdId!==null)return;holdId=e.pointerId;action.setPointerCapture(holdId);send('action');};
    action.onpointerup=e=>{if(e.pointerId===holdId){holdId=null;send('release');}};
    action.onlostpointercapture=()=>{if(holdId!==null){holdId=null;send('reset');}};
    action.onclick=e=>{if(e.detail===0 && holdId===null){send('action');send('release');}};
    refs.keypad=add(overlay,'div','keypad');
    refs.decisions=add(overlay,'div','decisions');
    refs.prompt=add(overlay,'div','touch-prompt');
    padMode='';
  }
  function updatePlay() {
    const s=state, past=s.age==='past';
    setText(refs.place,(past?'童年':'上海')+' / '+s.place);
    setText(refs.name,s.title||'自由探索');setText(refs.view,'视角');
    refs.view.title=s.cam;
    setText(refs.task,past?s.game:(s.phase===2?'选择今天的做法':s.phase===1?'今天的现场':'探索现场'));
    const note=past?s.memory:s.context;
    refs.notes.hidden=!note;setText(refs.read,note||'');
    if(!note) refs.read.hidden=true;
    const rule=past?help(data.rules[s.mode]||legacy[s.mode]):s.context||'';
    setText(refs.rule,rule);
    setText(refs.status,past?s.status||'':'');
    refs.status.hidden=!past;refs.meter.hidden=s.beat==null;
    if(s.beat!=null)refs.meter.value=s.beat;
    setText(refs.bearing,s.bearing||'');setText(refs.prompt,help(s.prompt||''));
    refs.near.hidden=!s.approach;setText(refs.near,s.walking?'停步':'走近目标');
    const actionLabel=past && s.running && ['code','charge'].includes(s.mode)?'按住 / 松开':past && !s.running && data.rules[s.mode]?'开始 / 互动':'互动';
    setText(action,actionLabel);
    const mode=past && s.running?s.mode:'';
    if(mode!==padMode) {
      refs.keypad.replaceChildren();padMode=mode;
      if(mode==='crate') {
        for(const [key,icon] of [['left','←'],['up','↑'],['down','↓'],['right','→']])button(refs.keypad,icon,key);
      } else {
        let numbers=[];
        if(mode==='pairs') numbers=[1,2,3,4,5,6];
        else if(mode==='balance') numbers=[1,3];
        else if(['sequence','switches','rotate','sort','spot','mix'].includes(mode)) numbers=[1,2,3];
        numbers.forEach(n=>button(refs.keypad,''+n,'digit',n));
      }
    }
    const opts=s.options||[], sig=JSON.stringify(opts);
    if(refs.decisions.dataset.sig!==sig){
      refs.decisions.dataset.sig=sig;refs.decisions.replaceChildren();
      opts.forEach((v,i)=>button(refs.decisions,v,'choose',i));
    }
    overlay.classList.toggle('choosing',opts.length>0);
  }
  function render(json) {
    state=JSON.parse(json);
    const next=state.page+':'+state.modal+':'+(state.page==='play' && !state.modal?state.age:'')+':'+(state.modal==='echo'?String(state.saved):'');
    if(next!==screen) {
      release();screen=next;overlay.replaceChildren();Object.keys(refs).forEach(k=>delete refs[k]);
      overlay.className=state.page==='play' && !state.modal?'touch-playing':'touch-menus';
      if(state.page==='menu')home();
      else if(state.page==='stories')catalog();
      else if(state.modal==='pause')pause();
      else if(state.modal==='archive')archive();
      else if(state.modal==='echo')result();
      else play();
    }
    if(state.page==='menu'){refs.adult.value=state.adult;refs.child.value=state.child;}
    if(state.modal==='pause') setText(refs.sound,state.quiet?'开启声音':'关闭声音');
    if(state.page==='play' && !state.modal)updatePlay();
  }
  window.EchoTouch={enabled, attach(fn,json) {
    send=fn;data=JSON.parse(json);overlay=add(document.body,'main');overlay.id='echo-touch';overlay.lang='zh-CN';
    document.documentElement.classList.add('echo-phone');
    window.addEventListener('blur',release);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
    window.addEventListener('orientationchange',release);
    overlay.addEventListener('contextmenu',e=>e.preventDefault());
  },render};
})();
