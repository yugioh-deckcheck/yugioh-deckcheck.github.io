(()=>{

const BITCOUNT = ((n) =>
{
    n = n - ((n >> 1) & 0x55555555)
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
    return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
});

const BOUND = ((pxPerBox, extraPx, idx) => ((pxPerBox * idx) + Math.min(extraPx, idx)));

window.ImageHash = {
    Distance: ((a,b) => { let s = 0; for (let i=0; i<8; ++i) s += BITCOUNT(a[i]^b[i]); return s; }),
    Hash: ((imagedata) =>
    {
        const width = imagedata.width;
        const height = imagedata.height;
        const widthPerBox = Math.floor(width / 16);
        const heightPerBox = Math.floor(height / 16);
        const widthExtraPixels = (width - widthPerBox*16);
        const heightExtraPixels = (height - heightPerBox*16);
        
        let total = 0;
        let pixels = [];
        let lums = [];
        for (let iY=0; iY<16; ++iY)
        {
            for (let iX=0; iX<16; ++iX)
            {
                const minX = BOUND(widthPerBox, widthExtraPixels, iX);
                const maxX = BOUND(widthPerBox, widthExtraPixels, iX+1);
                const minY = BOUND(heightPerBox, heightExtraPixels, iY);
                const maxY = BOUND(heightPerBox, heightExtraPixels, iY+1);
                
                let l = 0, n = 0;
                for (let y = minY; y < maxY; ++y)
                {
                    for (let x = minX; x < maxX; ++x)
                    {
                        const i = (y*width+x)*4;
                        const r = imagedata.data[i+0];
                        const g = imagedata.data[i+1];
                        const b = imagedata.data[i+2];
                        let lum = (r*.299 + g*.587 + b*.114);
                        
                        l += lum;
                        n += 1;
                    }
                }
                l /= n;
                
                pixels.push(l);
                total += l;
            }
        }
        
        const avg = (total / 256);
        let s = '';
        for (let i=0; i<256; ++i)
            s += ((pixels[i] <= avg) ? '0' : '1');
        return [
            parseInt(s.substr(  0,32),2),
            parseInt(s.substr( 32,32),2),
            parseInt(s.substr( 64,32),2),
            parseInt(s.substr( 96,32),2),
            parseInt(s.substr(128,32),2),
            parseInt(s.substr(160,32),2),
            parseInt(s.substr(192,32),2),
            parseInt(s.substr(224,32),2),
        ];
    }),
    Visualize: ((canvas, baseX, baseY, width, height, hash) =>
    {
        const ctx = canvas.getContext('2d');
        const widthPerBox = Math.floor(width / 16);
        const heightPerBox = Math.floor(height / 16);
        const widthExtraPixels = (width - widthPerBox*16);
        const heightExtraPixels = (height - heightPerBox*16);
        for (let j=0; j<8; ++j)
        {
            const entry = (hash[j] >>> 0).toString(2).padStart(32,'0');
            for (let i=0; i<16; ++i)
            {
                const minX = BOUND(widthPerBox, widthExtraPixels, i + 0);
                const maxX = BOUND(widthPerBox, widthExtraPixels, i + 1);
                const minY = BOUND(heightPerBox, heightExtraPixels, j*2 + 0);
                const maxY = BOUND(heightPerBox, heightExtraPixels, j*2 + 1);
                ctx.fillStyle = ((entry.charAt(i+ 0) == '1') ? 'white' : 'black');
                ctx.fillRect(baseX + minX, baseY + minY, maxX - minX, maxY - minY);
            }
            for (let i=0; i<16; ++i)
            {
                const minX = BOUND(widthPerBox, widthExtraPixels, i + 0);
                const maxX = BOUND(widthPerBox, widthExtraPixels, i + 1);
                const minY = BOUND(heightPerBox, heightExtraPixels, j*2 + 1);
                const maxY = BOUND(heightPerBox, heightExtraPixels, j*2 + 2);
                
                ctx.fillStyle = ((entry.charAt(i+16) == '1') ? 'white' : 'black');
                ctx.fillRect(baseX + minX, baseY + minY, maxX - minX, maxY - minY);
            }
        }
    }),
};

})();
