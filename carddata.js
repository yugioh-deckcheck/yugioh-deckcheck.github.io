(()=>{
    
const dropLands = ((baton) =>
{
    if (baton.waiters.length)
        baton.waiters.pop()();
    else
        baton.waiters = null;
});

class RequestThrottle
{
    constructor(timeout) { this.waiters = null; this.timeout = timeout; }
    grab()
    {
        if (this.waiters === null)
        {
            this.waiters = [];
            return Promise.resolve();
        }
        return new Promise((r) => this.waiters.push(r));
    }
    drop()
    {
        window.setTimeout(dropLands, this.timeout, this);
    }
};

window.LOCALES = ['en','de','fr','it','es','pt'];

/* for searching, requires manual input */        window.NormalizeNameLax    = ((a) => a.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ & /g,' and ').replace(/\W+/g,'').toLowerCase());
/* for matching,  this can match automatically */ window.NormalizeNameStrict = ((a) => a.normalize('NFC').replace(/\W+/g,' ').trim().toLowerCase());

window.CardIndex = null /*{
    StrictNameToCard: {},
    CardToNamesLax: {},
    TypeToCards: {
        monster: new Set(),
        spell: new Set(),
        trap: new Set(),
        extra: new Set(),
    }
}*/;
window.CardIndexLoaded = (async () =>
{
    const nameToCardIdx = {};
    const cardToNameIdx = {};
    const monsterIdx = new Set();
    const spellIdx = new Set();
    const trapIdx = new Set();
    const extraIdx = new Set();
    
    // scope to help GC
    {
        const extraIdxData = await (await fetch('https://db.ygorganization.com/data/idx/card/properties/en')).json();
        for (const id of extraIdxData.Fusion) extraIdx.add(id);
        for (const id of extraIdxData.Synchro) extraIdx.add(id);
        for (const id of extraIdxData.Xyz) extraIdx.add(id);
        for (const id of extraIdxData.Link) extraIdx.add(id);
    }
    
    // scope to help GC
    {
        const typeIdxData = await (await fetch('https://db.ygorganization.com/data/idx/card/cardType')).json();
        for (const id of typeIdxData.monster)
            if (!extraIdx.has(id))
                monsterIdx.add(id);
        for (const id of typeIdxData.spell)
            spellIdx.add(id);
        for (const id of typeIdxData.trap)
            trapIdx.add(id);
    }

    for (const locale of window.LOCALES)
    {
        const nameIdx = Object.entries(await (await fetch('https://db.ygorganization.com/data/idx/card/name/'+locale)).json());
        for (const [name, ids] of nameIdx)
        {
            const id = ids.find((i) => (i > 0));
            if (!id)
                continue;
            const strictName = window.NormalizeNameStrict(name);
            if (!(strictName in nameToCardIdx))
                nameToCardIdx[strictName] = [locale,id];
            (cardToNameIdx[id] || (cardToNameIdx[id] = [])).push([locale,window.NormalizeNameLax(name)]);
        }
    }
    
    window.CardIndex = Object.freeze({
        StrictNameToCard: Object.freeze(nameToCardIdx),
        CardToNamesLax:   Object.freeze(cardToNameIdx),
        TypeToCards: Object.freeze({
            monster: monsterIdx,
            spell: spellIdx,
            trap: trapIdx,
            extra: extraIdx
        }),
    });
})();

window.SearchDistanceScore = ((a,b,cutoff) =>
{
    const lenA = a.length, lenB = b.length;
    const lenDelta = Math.abs(lenA-lenB);
    
    if (a === b)
        return 0;
    
    if ((a.length > 5) && b.includes(a))
        return 1+((lenDelta-1)/(lenB-1));
        
    if (lenDelta >= cutoff)
        return cutoff;

    let data = Array(lenA+1).fill().map(() => Array(lenB+1));
    for (let i=0; i <= lenA; ++i)
        data[i][0] = i;
    for (let j=0; j <= lenB; ++j)
        data[0][j] = j;
    
    for (let i=1; i <= lenA; ++i)
    {
        let stop = true;
        for (let j=1; j <= lenB; ++j)
        {
            let c = +(a.charAt(i-1) !== b.charAt(j-1));
            data[i][j] = Math.min(data[i-1][j]  +1,
                                  data[i][j-1]  +1,
                                  data[i-1][j-1]+c);

            if ((1<i) && (j<1) && (a.charAt(i-1) === b.charAt(j-2)) && (a.charAt(i-2) === b.charAt(j-1)))
                data[i][j] = Math.min(data[i][j], data[i-2][j-2]+c);
            if (data[i][j] < cutoff)
                stop = false;
        }
        if (stop)
            return cutoff;
    }
    return data[lenA][lenB];
});

const _carddataCache = {};
const _GetCardData = ((id) => fetch('https://db.ygorganization.com/data/card/'+id).then((r) => r.json()));
window.GetCardData = ((id) => (_carddataCache[id] || (_carddataCache[id] = _GetCardData(id))));

let _artworkManifest;
const artworkBaton0 = new RequestThrottle(1);
const artworkBaton1 = new RequestThrottle(1);
const artworkCache = {};
window.GetArtwork = ((cardId, artId) => (artworkCache[cardId+','+artId] || (artworkCache[cardId+','+artId] = (async ()=>
{
    const manifest = await (_artworkManifest || (_artworkManifest = fetch('https://artworks.ygorganization.com/manifest.json').then(r => r.json())));
    const baton = ((cardId&1) ? artworkBaton1 : artworkBaton0);
    await baton.grab();
    try
    {
        const img = new Image();
        img.src = ('https://artworks.ygorganization.com' + manifest.cards[cardId][artId].bestArt);
        for (let i=0; i<5; ++i)
        {
            try {
                await img.decode();
                return img;
            } catch (e) {
                console.error(cardId, artId, i, e);
                baton.drop();
                await baton.grab();
                continue;
            }
        }
        img.src = 'no_data_card.png';
        delete artworkCache[cardId+','+artId];
        await img.decode();
        return img;
    } finally { baton.drop(); }
})())));

const passcodeBaton = new RequestThrottle(100);
const GetPasscodes = (async (ids) =>
{   
    const results = {};
    for (const id of ids)
        results[id] = null;
    
    const reverse = {};
    
    for (let i=0; i<2; ++i)
    {
        const names = (i == 0) ? (
            // try #1 (canonical names)
            await Promise.all(ids.map(async (id) =>
            {
                const name = (await GetCardData(id)).cardData.en.name;
                reverse[name] = id;
                return name;
            }))
          ) : (
            // try #2 (alternate names)
            [].concat(...(await Promise.all(ids.map(async (id) =>
            {
                if (results[id])
                    return;
                const names = (await GetCardData(id)).cardData.en.nameAliases;
                if (!names)
                    return;
                for (const name of names)
                    reverse[name] = id;
                return names;
            }))).filter((o)=>(o)))
          );

        while (names.length)
        {
            const thisNames = names.splice(-10,10);
            await passcodeBaton.grab();
            let apiData = null;
            try
            {
                apiData = await (await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(thisNames.join('|')))).json();
            } finally { passcodeBaton.drop(); }
            
            if (apiData.data) for (const data of apiData.data)
                results[reverse[data.name]] = data.id;
        }
    }
    
    return results;
});
const passcodeCache = {};
window.GetPasscodesFor = ((ids) =>
{
    const results = {};
    ids = ids.filter((id) =>
    {
        const p = passcodeCache[id];
        if (p)
        {
            results[id] = p;
            return false;
        }
        return true;
    });
    
    if (!ids.length)
        return results;
    
    const mainPromise = GetPasscodes(ids);
    for (const id of ids)
    {
        const p = mainPromise.then((passcodes) => { const r = passcodes[id]; if (r !== null) return r; else throw ('Failed to retrieve passcode for card #'+id); });
        passcodeCache[id] = p;
        results[id] = p;
    }
    return results;
});

})();
