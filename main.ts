import{mkdirSync as K,readdirSync as R,readFileSync as F,writeFileSync as W}from'node:fs';
import{join as J}from'node:path';
let I=process.env.MAKEFUN_INPUT_DIR||'/input',O=process.env.MAKEFUN_OUTPUT_DIR||'/output',E=new TextEncoder();
let T={0:0,1:17,2:65,3:4,4:6,5:10,6:11,7:15,16:9,17:9,18:9,19:9,20:9,21:9,22:9,23:5,24:9,25:9,26:9,27:5,28:9,29:9,30:9,32:9,33:9,34:9,48:32,49:36,50:36,51:32,52:0,64:5,65:8,80:4,81:4,82:1,83:4};
let G=[(a,b)=>(a+b)|0,(a,b)=>(a-b)|0,(a,b)=>Math.imul(a,b),(a,b)=>b?(a/b)|0:void 0,(a,b)=>b?(a%b)|0:void 0,(a,b)=>b?Math.floor((a>>>0)/(b>>>0))|0:void 0,(a,b)=>b?((a>>>0)%(b>>>0))|0:void 0,,(a,b)=>a&b,(a,b)=>a|b,(a,b)=>a^b,,(a,b)=>a<<(b&31),(a,b)=>a>>(b&31),(a,b)=>(a>>>(b&31))|0,,(a,b)=>a==b?1:0,(a,b)=>a<b?1:0,(a,b)=>(a>>>0)<(b>>>0)?1:0];
let run=(p,q)=>{
let D=[],C=[],m=Array(256).fill(0),o=new Uint8Array(65536),l=0,i=0,c=0,s=0,nx=0,ex=-1,a,b,y;
let B=f=>{b=D.pop();let r=f(D.pop(),b);if(r===undefined)ex=4;else D.push(r)};
let r=()=>((p[nx-2]|p[nx-1]<<8)<<16)>>16;
while(ex<0){
if(s==1e6){ex=10;break}
let n=p.length;
if(c<0||c>=n){ex=9;break}
let op=p[c],t=T[op];
if(t===undefined){ex=5;break}
nx=c+1+(t>>4);
if(nx>n){ex=9;break}
s++;c=nx;
let w=t>>2&3;
if(D.length<w){ex=2;break}
if(D.length-w+(t&3)>256){ex=3;break}
switch(op){
case 0:ex=0;break;
case 1:D.push((p[nx-1]<<24)>>24);break;
case 2:D.push(p[nx-4]|p[nx-3]<<8|r()<<16);break;
case 3:D.pop();break;
case 4:D.push(D[D.length-1]);break;
case 5:b=D.pop();D.push(b,D.pop());break;
case 6:D.push(D[D.length-2]);break;
case 7:D.push(D.splice(D.length-3,1)[0]);break;
case 23:D[D.length-1]=-D[D.length-1]|0;break;
case 27:D[D.length-1]=~D[D.length-1];break;
case 48:c+=r();break;
case 49:if(!D.pop())c+=r();break;
case 50:if(D.pop())c+=r();break;
case 51:if(C.length==64){ex=7;break}C.push(nx);c=r()&65535;break;
case 52:if(!C.length){ex=8;break}c=C.pop();break;
case 64:a=D[D.length-1];if(a<0||a>255){ex=6;break}D[D.length-1]=m[a];break;
case 65:a=D.pop();if(a<0||a>255){ex=6;break}m[a]=D.pop();break;
case 80:y=E.encode(String(D[D.length-1]));if(l+y.length>65536){ex=11;break}D.pop();o.set(y,l);l+=y.length;break;
case 81:if(l>65535){ex=11;break}o[l++]=D.pop()&255;break;
case 82:D.push(i<q.length?q[i++]:-1);break;
case 83:ex=D.pop()&255;break;
default:B(G[op-16])
}
}
return[o.subarray(0,l),ex];
};
for(let id of R(I).sort()){let[u,v]=run(F(J(I,id,'program.bin')),F(J(I,id,'input.bin')));K(J(O,id),{recursive:true});W(J(O,id,'stdout.bin'),u);W(J(O,id,'exit.txt'),v+'\n')}
