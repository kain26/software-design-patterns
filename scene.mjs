import * as THREE from './vendor/three.module.min.js';

const paint = {actor:0x6876da, hub:0x6354c4, block:0x5d92d3, gem:0xe8788e, ring:0x42a5aa, stack:0x6572b8};

function model(shape) {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({color:paint[shape],roughness:.32,metalness:.08});
  const inset = new THREE.MeshStandardMaterial({color:0xeef1ff,roughness:.45});
  const add = (geometry, x, y, z, material = shell) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    group.add(mesh);
    return mesh;
  };

  switch (shape) {
    case 'actor':
      add(new THREE.SphereGeometry(.29,24,18),0,1.07,0);
      add(new THREE.SphereGeometry(.47,24,18),0,.48,0).scale.set(1,.83,.75);
      break;
    case 'hub':
      add(new THREE.CylinderGeometry(.64,.64,.36,6),0,.56,0).rotation.y = Math.PI / 6;
      add(new THREE.CylinderGeometry(.44,.44,.17,6),0,.83,0,inset).rotation.y = Math.PI / 6;
      add(new THREE.CylinderGeometry(.23,.23,.11,6),0,.97,0).rotation.y = Math.PI / 6;
      break;
    case 'ring':
      add(new THREE.TorusGeometry(.43,.13,16,38),0,.7,0).rotation.y = -.2;
      add(new THREE.TorusGeometry(.3,.075,14,30),.16,.61,.22,inset).rotation.y = -.36;
      break;
    case 'gem':
      add(new THREE.OctahedronGeometry(.64),0,.73,0).rotation.y = .33;
      break;
    case 'stack':
      for (const level of [0,1,2]) {
        add(new THREE.BoxGeometry(1,.19,.75),0,.34+level*.22,0).rotation.y = -.18;
        add(new THREE.BoxGeometry(.18,.05,.03),.2,.35+level*.22,.36,inset);
      }
      break;
    default:
      add(new THREE.BoxGeometry(.96,.7,.68),0,.57,0).rotation.y = -.16;
      add(new THREE.BoxGeometry(.48,.08,.35),0,.96,0,inset).rotation.y = -.16;
  }

  const base = add(
    new THREE.CylinderGeometry(.72,.78,.12,38),0,.13,0,
    new THREE.MeshStandardMaterial({color:0xc0cbe9,roughness:.65}),
  );
  base.scale.z=.9;
  return group;
}

export function createStage({stage, canvas, labels, packet, fallback}, onResize) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  } catch {
    canvas.hidden = true;
    fallback.hidden = false;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0,13,17);
  camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb3bcde,2.35));
  const key = new THREE.DirectionalLight(0xfff5e1,2.5);
  key.position.set(-4,10,6);
  scene.add(key);

  const grid = new THREE.GridHelper(150,150,0xaabedb,0xb7cbe1);
  grid.material.transparent = true;
  grid.material.opacity = .47;
  scene.add(grid);
  const objects = new THREE.Group();
  const routes = new THREE.Group();
  scene.add(objects,routes);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(.16,20,16),
    new THREE.MeshBasicMaterial({color:0xffb92b,depthTest:false}),
  );
  dot.renderOrder = 4;
  dot.visible = false;
  scene.add(dot);

  let pattern, width, height, nodes={};
  let activeRoute;
  const quiet = new THREE.LineBasicMaterial({color:0x7189b5,transparent:true,opacity:.38});
  const active = new THREE.LineBasicMaterial({color:0x5d4ecc});

  function curve(from,to) {
    const a = nodes[from].mesh.position.clone();
    const b = nodes[to].mesh.position.clone();
    a.y = .45;
    b.y = .45;
    const middle = a.clone().lerp(b,.5);
    middle.y = 2.15;
    return new THREE.QuadraticBezierCurve3(a,middle,b);
  }

  function position(element, vector, offsetY = 0) {
    const at = vector.clone().project(camera);
    const half = element.offsetWidth / 2 + 4;
    const x = THREE.MathUtils.clamp((at.x+1)*width/2,half,width-half);
    element.style.left = x+'px';
    element.style.top = ((1-at.y)*height/2+offsetY)+'px';
  }

  function clearRoutes() {
    for (const line of [...routes.children]) {
      routes.remove(line);
      line.geometry.dispose();
    }
    activeRoute = undefined;
  }

  function layout() {
    width = Math.max(1,stage.clientWidth);
    height = Math.max(1,stage.clientHeight);
    if (!renderer || !pattern) return;
    const span = width < 470 ? 8.7 : 9.6;
    const across = span * width / height;
    camera.left = -across/2;
    camera.right = across/2;
    camera.top = span/2;
    camera.bottom = -span/2;
    camera.near = .1;
    camera.far = 120;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(width,height,false);

    for (const [id, entry] of Object.entries(pattern.nodes)) {
      const {mesh,label} = nodes[id];
      mesh.position.set((entry.x-.5)*across,0,(entry.y-.5)*span*camera.position.length()/camera.position.y);
      mesh.scale.setScalar(width < 470 ? .7 : 1);
      position(label,mesh.position,9);
    }

    clearRoutes();
    const all = new Set();
    for (const {calls} of pattern.steps) {
      for (const [from,to] of calls) {
        const key = [from,to].sort().join('/');
        if (all.has(key)) continue;
        all.add(key);
        routes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve(from,to).getPoints(24)),quiet));
      }
    }
    activeRoute = new THREE.Line(new THREE.BufferGeometry(),active);
    routes.add(activeRoute);
  }

  function setPattern(next) {
    pattern = next;
    if (!renderer) return;
    const materials = new Set();
    objects.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      materials.add(object.material);
    });
    materials.forEach(material => material.dispose());
    objects.clear();
    labels.replaceChildren();
    nodes = {};
    for (const [id,entry] of Object.entries(next.nodes)) {
      const mesh = model(entry.shape);
      objects.add(mesh);
      const label = document.createElement('div');
      label.className = 'object-label';
      const title = document.createElement('b');
      title.textContent = entry.name;
      const role = document.createElement('small');
      label.append(title,role);
      labels.append(label);
      nodes[id] = {mesh,label,role};
    }
    layout();
  }

  function draw(visible, roles, call, progress) {
    if (!renderer) {
      const members = [...visible].map(id=>pattern.nodes[id].name);
      const flow = call ? `. ${pattern.nodes[call[0]].name} calls ${call[2]} on ${pattern.nodes[call[1]].name}` : '';
      fallback.textContent = `This browser cannot display 3D. Current objects: ${members.join(', ')}${flow}. Playback controls and step explanations are available.`;
      return;
    }
    for (const [id,{mesh,label,role}] of Object.entries(nodes)) {
      const pending = !visible.has(id);
      label.dataset.active = Boolean(call?.slice(0,2).includes(id));
      label.dataset.pending = pending;
      mesh.visible = !pending;
      const text = pending ? 'Not active yet' : (roles[id] ?? pattern.nodes[id].role);
      if (role.textContent !== text) {
        role.textContent = text;
        position(label,mesh.position,9);
      }
    }
    if (call) {
      const [from,to,label] = call;
      const path = curve(from,to);
      const signature = `${from}/${to}`;
      if (activeRoute.userData.signature !== signature) {
        activeRoute.geometry.dispose();
        activeRoute.geometry = new THREE.BufferGeometry().setFromPoints(path.getPoints(32));
        activeRoute.userData.signature = signature;
      }
      activeRoute.visible = true;
      dot.visible = true;
      dot.position.copy(path.getPoint(progress));
      packet.hidden = false;
      if (packet.textContent !== label) packet.textContent = label;
      position(packet,dot.position,-8);
    } else {
      activeRoute.visible = false;
      dot.visible = false;
      packet.hidden = true;
    }
    renderer.render(scene,camera);
  }

  new ResizeObserver(() => {
    if (!pattern) return;
    layout();
    onResize();
  }).observe(stage);
  return {setPattern,draw};
}
