import assert from 'node:assert/strict';
import {spiroPoints, traceRuns, runsToPath, gravityStep, posedBones, skinPoint, samplePose, voxelOBJ} from '../tools/studio-core.js';
import {buildPhysicsExtra, extraPhysicsPresets, fluidForces} from '../tools/physics-extra.js';
import {Matter as M} from '../tools/vendor/physics.js';
const points=spiroPoints({outer:120,inner:40,offset:60,turns:1},300);
assert(Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-10);
assert(points.every(p=>Number.isFinite(p.x+p.y)));
const pixels=new Uint8ClampedArray(3*3*4);for(let i=0;i<9;i+=1){pixels[i*4+3]=i===4?0:255;}
const groups=traceRuns(pixels,3,3);assert.equal(groups.length,1);assert.equal(groups[0].runs.reduce((n,r)=>n+r[2],0),8);
assert.equal(runsToPath([[0,0,3],[0,1,3],[0,2,3]]),'M0 0h3v3h-3z');
const rgb=traceRuns(new Uint8ClampedArray([255,0,0,255,0,255,0,255]),2,1,140,8);assert.equal(rgb.length,2);
const bodies=[{x:0,y:0,mass:1000,vx:0,vy:0,fixed:true},{x:100,y:0,mass:1,vx:0,vy:Math.sqrt(10),fixed:false}];
for(let i=0;i<10000;i+=1){gravityStep(bodies,.01,1,.001);}
assert(Math.abs(Math.hypot(bodies[1].x,bodies[1].y)-100)<.01);
assert.equal(bodies[0].x,0);assert.equal(bodies[0].y,0);
const bones=[{x:0,y:0,parent:-1},{x:10,y:0,parent:0}];
const pose=posedBones(bones,[90,0]);assert(Math.abs(pose[1].x)<1e-8);assert(Math.abs(pose[1].y-10)<1e-8);
const identity=skinPoint({x:25,y:50},bones,posedBones(bones,[0,0]));assert(Math.abs(identity.x-25)<1e-8&&Math.abs(identity.y-50)<1e-8);
assert.deepEqual(samplePose([{t:0,angles:[0,10]},{t:2,angles:[20,30]}],1,2),[10,20]);
const obj=voxelOBJ([{x:0,y:0,z:0,color:'#ffffff'},{x:1,y:0,z:0,color:'#ff0000'}]);assert.equal(obj.split('\n').filter(l=>l.startsWith('f ')).length,10);
for(const [kind] of extraPhysicsPresets){
  const engine=M.Engine.create(),items=[],links=[];
  function add(type,x,y,size,opts={}){const b=type==='circle'?M.Bodies.circle(x,y,size/2,opts):M.Bodies.rectangle(x,y,type==='wall'||type==='bar'?size*3:size,type==='wall'||type==='bar'?12:size,opts);b.plugin={};M.Composite.add(engine.world,b);items.push(b);return b;}
  const connect=(a,b,pa,pb,stiffness,length)=>{const c=M.Constraint.create({bodyA:a,bodyB:b,pointA:pa,pointB:pb,stiffness,length});M.Composite.add(engine.world,c);links.push(c);return c;};
  assert(buildPhysicsExtra(kind,{M,add,connect,stiffness:.1}));assert(items.length<=240);assert(links.length<=320);
  for(let i=0;i<60;i+=1){fluidForces(M,items.filter(b=>b.plugin.fluid));M.Engine.update(engine,1000/60);}
  assert(items.every(b=>Number.isFinite(b.position.x+b.position.y+b.velocity.x+b.velocity.y)),kind);
  M.Engine.clear(engine);
}
console.log('PASS: traced alpha holes/colors, merged vector paths, closed spirograph, orbit stability, hierarchical skinning/keyframes, voxel face culling, all physical presets and fluid integration.');
