document.getElementById('pdf-input').value = '';
document.getElementById('pdf-input').addEventListener('change', async function()
{
    if (!this.files.length)
        return;
    if (document.body.className !== 'state-choose')
        return;
    
    const file = this.files[0];
    if (!file) return;

    document.getElementById('loading-box').lastElementChild.innerText = ('Loading...');
    document.body.className = 'state-loading';

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
        document.body.className = 'state-loading';
        document.getElementById('loading-box').lastElementChild.innerText = ('Failed: '+e);
        await sleep(5000);
        this.value = '';
        document.body.className = 'state-choose';
    }
});

document.body.className = 'state-choose';
window.clearTimeout(window.noasyncTimeout);
