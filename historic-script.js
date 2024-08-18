// define constants for the tables, as they won't change
const nonprofitsTable = base.getTable('Nonprofits');
const fundersTable = base.getTable('Funders');

// helper to fetch API data
async function fetchApiData(url) {
    let response = await remoteFetchAsync(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
}

// helper to 
function getFilingData(einData) {
    if (einData.filings_with_data.length <= 0) return null;
                // add filing data to new record
            // function for withData, 990, 990PF, or 990EZ
}

// helper to find most recent filing with a pdf_url, using 2 pointers
function getLatestPdf(einData) {
    let { filings_with_data: withData, filings_without_data: withoutData } = einData;
    let withDataPtr = 0;
    let withoutDataPtr = 0;
    let itemWithData, itemWithoutData;
    while (withDataPtr < withData.length || withoutDataPtr < withoutData.length) {
        itemWithData = withData[withDataPtr];
        itemWithoutData = withoutData[withoutDataPtr];
        // if one list exhausted/empty, return from the other
        if (withDataPtr >= withData.length)
            return itemWithoutData.pdf_url ? { 'PDF URL': itemWithoutData.pdf_url, 'PDF Year': itemWithoutData.tax_prd_yr } : null;
        if (withoutDataPtr >= arrayWithoutData.length)
            return itemWithData.pdf_url ? { 'PDF URL': itemWithData.pdf_url, 'PDF Year': itemWithData.tax_prd_yr } : null;
        // if both have valid PDFs, compare years
        if (itemWithData.pdf_url && itemWithoutData.pdf_url) {
            return ( itemWithData.tax_prd_yr >= itemWithoutData.tax_prd_yr
                ? { 'PDF URL': itemWithData.pdf_url, 'PDF Year': itemWithData.tax_prd_yr }
                : { 'PDF URL': itemWithoutData.pdf_url, 'PDF Year': itemWithoutData.tax_prd_yr }
            );
        }
        // if PDF URL missing, move pointer
        if (!itemWithData.pdf_url) withDataPtr++;
        if (!itemWithoutData.pdf_url) withoutDataPtr++;
    }
    // no valid PDFs found
    return null;
}



// function to process each record
async function processFunderRecord(record) {
    if (record.name === "") return;

    let encodedName = encodeURI(record.name).replace('-', '%20');
    let orgUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodedName}`;
    let orgData = await fetchApiData(orgUrl);

    if (orgData.total_results == 0) return;

    for (let org of orgData.organizations) {

        // query with EIN number
        let einUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${org.ein}`;
        let einData = await fetchApiData(einUrl);

        // synthesize query results
        filingData = getFilingData(einData.filings_with_data[0]);
        latestPdf = getLatestPdf(einData);

        // make and add new record
        let newRecord = {
            'Funder': [{ id: record.id }],
            'Name': org.name,
            'EIN': org.ein,
            'Score': org.score,
            'City': org.city,
            'State': org.state,
            'NTEE Code': org.ntee
        };

        newRecord = Object.assign(filingData, latestPdf);

        await nonprofitsTable.createRecordAsync(newRecord);
    }
}

// main function to run the script
async function main() {
    try {
        const { records } = await fundersTable.selectRecordsAsync();
        for (const record of records) {
            await processFunderRecord(record);
        }
    } catch (error) {
        console.error('Error processing records:', error);
    }
}

// execute the main function
await main();