(()=>{

const rgbAverage = ((data) =>
{
    data = data.data;
    let r=0,g=0,b=0,n=0;
    for (let i=0; i<data.length; i+=4)
    {
        r += data[i+0];
        g += data[i+1];
        b += data[i+2];
        ++n;
    }
    return [r/n,g/n,b/n];
});

const sqdist = ((a,b) =>
{
    let s = 0;
    for (let i=0; i<a.length; ++i)
    {
        const d = a[i]-b[i];
        s += (d*d);
    }
    return s;
});

let fingerprintCanvas = document.createElement('canvas');
fingerprintCanvas.width = 200;
fingerprintCanvas.height = 290;
let fingerprintCtx = fingerprintCanvas.getContext('2d');
fingerprintCtx.imageSmoothingEnabled = false;
window.CardFingerprint = {
    Fingerprint: (async (image, sx, sy, sWidth, sHeight, hashMask) =>
    {
        fingerprintCtx.drawImage(image, sx || 0, sy || 0, sWidth || image.width, sHeight || image.height, 0, 0, 200, 290);
        
        const [bg1R, bg1G, bg1B] = rgbAverage(fingerprintCtx.getImageData(10, 51, 7, 157));
        const [bg2R, bg2G, bg2B] = rgbAverage(fingerprintCtx.getImageData(184, 51, 7, 157));
        const bgR = ((bg1R+bg2R)/2), bgG = ((bg1G+bg2G)/2), bgB = ((bg1B+bg2B)/2);
        
        const [attrR, attrG, attrB] = rgbAverage(fingerprintCtx.getImageData(164, 14, 20, 19));
        
        await EnsureScriptLoaded('/neuron/imagehash.js');
        const hash = ImageHash.Hash(fingerprintCtx.getImageData(25, 54, 150, 150), hashMask);
        
        return [[bgR, bgG, bgB], [attrR, attrG, attrB], hash];
    }),
    CompareCategories: [['total','overall'],['art','artwork'],['bg','background'],['attr','attribute'],],
    Compare: (([bgLeft, attrLeft, hashLeft], [bgRight, attrRight, hashRight]) =>
    {
        const bgDist = Math.sqrt(sqdist(bgLeft, bgRight)/3);
        const attrDist = Math.sqrt(sqdist(attrLeft, attrRight)/3);
        const hashDist = ImageHash.Distance(hashLeft, hashRight);
        
        const bgScore = Math.max(0,128-bgDist)*100/128;
        const attrScore = Math.max(0,128-attrDist)*100/128;
        const hashScore = Math.max(0,128-hashDist)*100/128;
        
        const totalScore = Math.min(100-(100-hashScore)*.8, Math.sqrt(((bgScore*bgScore) + (attrScore*attrScore) + (hashScore*hashScore)*4)/6));
        
        return {
            total: totalScore,
            art: hashScore,
            bg: bgScore,
            attr: attrScore,
        };
    }),
    Visualize: ((canvas, [[bgR, bgG, bgB], [attrR, attrG, attrB], hash]) =>
    {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 200, 290);
        
        ctx.fillStyle = ('rgb('+bgR+','+bgG+','+bgB+')');
        ctx.fillRect(10, 51, 7, 157);
        ctx.fillRect(184, 51, 7, 157);
        
        ctx.fillStyle = ('rgb('+attrR+','+attrG+','+attrB+')');
        ctx.fillRect(164, 14, 20, 19);
        
        ImageHash.Visualize(canvas, 25, 54, 150, 150, hash);
    })
};

})();
