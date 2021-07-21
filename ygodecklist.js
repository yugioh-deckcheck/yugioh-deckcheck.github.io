(() => {

const pdfInput = document.getElementById('pdf-input');

pdfInput.value = '';
pdfInput.addEventListener('change', async () =>
{
    if (!pdfInput.files.length)
        return;
    if (document.body.className !== 'state-choose')
        return;
    
    const file = pdfInput.files[0];
    if (!file) return;

    StartLoading();

    try
    {
        let format = null;
        if (file.type === 'application/pdf')
            format = 'pdf';
        else if (file.type.startsWith('image/'))
            format = 'neuron';
        else if (file.name.endsWith('.pdf'))
            format = 'pdf';
        else if (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg'))
            format = 'neuron';
        
        switch (format)
        {
            case 'pdf':
                await EnsureScriptLoaded('parsePDF.js');
                await window.ParsePDFFile(file);
                break;
            case 'neuron':
                await EnsureScriptLoaded('parseNeuron.js');
                await window.ParseNeuronExport(file);
                break;
            default:
                throw ('Failed to find suitable import type for \''+file.name+'\'');
        }
    } catch (e) {
        console.error(e);
        StartLoading();
        SetLoadingMessage('Failed: '+e);
        await sleep(5000);
        pdfInput.value = '';
        document.body.className = 'state-choose';
    }
});

/*const chooseBox = document.getElementById('choose-elm');
chooseBox.addEventListener('dragover', (e) => { e.preventDefault(); });
chooseBox.addEventListener('dragenter', (e) => { e.preventDefault(); });
chooseBox.addEventListener('drop', (e) =>
{
    e.preventDefault();
    // foiled by CORS (for now)
});*/

document.body.className = 'state-choose';
window.clearTimeout(window.noasyncTimeout);

})();
