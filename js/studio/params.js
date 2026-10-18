// Classic studio: palette and design parameters (D)


const PAL = {wall:'#c8a97e',stone:'#8f7f6a',win:'#2f5d9e',door:'#1a7f6b',roof:'#7a8fa6',bal:'#2a2a2a',cor:'#e0c080',chim:'#b5523b',dorm:'#9a8a70'};
const rgb = (h) => [1,3,5].map((i) => Math.pow(parseInt(h.substr(i,2),16)/255, 2.2));
const D = {w:16,d:12,floors:6,fh:3.2,gh:4.2,bay:3.2,mh:3.4,seed:7,roof:'hip',bal:1,custom:[],fxGlass:true,fxConc:true,fxRoof:true,drain:true,detail:true,models:true,dst:0,wst:0,prog:1};

export { PAL, rgb, D };
