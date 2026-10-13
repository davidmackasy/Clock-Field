/** Normalize phone camera/gallery images to a bounded JPEG before upload. */
export async function prepareWorkPhoto(file: File): Promise<string> {
 if(!file.type.startsWith('image/'))throw new Error('Choose a photo file.');
 if(file.size>25*1024*1024)throw new Error('Choose a photo smaller than 25 MB.');
 const url=URL.createObjectURL(file);
 try {
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('This photo format cannot be opened. Take a new camera photo or choose a JPEG or PNG.'));image.src=url;});
  const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Unable to prepare the photo. Try again.');
  context.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.82);
 }finally{URL.revokeObjectURL(url);}
}
