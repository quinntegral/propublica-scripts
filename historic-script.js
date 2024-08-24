// define constants for the tables, as they won't change
const nonprofitsTable = base.getTable('Nonprofits');
const fundersTable = base.getTable('Funders');

// helper to fetch API data
async function fetchApiData(url) {
    let response = await remoteFetchAsync(url);
    return await response.json();
}

// helper to add applicable filing data based on form type
function getFilingData(filing) {
    switch(filing.formtype) {
        case 0: // 990
            return {
                'Filing Year': filing.tax_prd_yr,
                'Total Assets' : filing.totassetsend,
                'Total Expenses' : filing.totfuncexpns,
                'Total Revenue' : filing.totrevenue
            }
        case 1: // 990EZ
            return {
                'Filing Year': filing.tax_prd_yr,
                'Total Assets' : filing.totassetsend,
                'Total Expenses' : filing.totexpns,
                'Total Revenue' : filing.totrevnue
            }
        case 2: // 990PF
            return {
                'Filing Year': filing.tax_prd_yr,
                'Total Assets' : filing.totassetsend,
                'Total Expenses' : filing.totexpnspbks,
                'Total Revenue' : filing.totrcptperbks,
                'Total Exempt Expenses' : filing.totexpnsexempt
            }
        default:
            return null
    }
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
        if (withoutDataPtr >= withoutData.length)
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
    console.log(orgData);

    if (orgData.total_results == 0) return;

    for (let org of orgData.organizations) {
        // query with EIN number
        let einUrl = `https://projects.propublica.org/nonprofits/api/v2/organizations/${org.ein}.json`;
        let einData = await fetchApiData(einUrl);
        console.log(einData);

        // synthesize query results
        let filingData = null;
        let latestPdf = null;
        if (typeof einData.filings_with_data != "undefined" && einData.filings_with_data.length > 0) {
            filingData = getFilingData(einData.filings_with_data[0]);
        }
        if (typeof einData.filings_without_data != "undefined" && typeof einData.filings_with_data != "undefined") {
                latestPdf = getLatestPdf(einData);
        }

        // make and add new record
        let newRecord = {
            'Funder': [{ id: record.id }],
            'Name': org.name,
            'EIN': org.ein + '',
            'ProPublica Link': `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,
            'Score': org.score,
            'City': org.city,
            'State': org.state,
            'NTEE Code': org.ntee_code
        };
        newRecord = Object.assign(newRecord, filingData, latestPdf);
        await nonprofitsTable.createRecordAsync(newRecord);
    }
}

// main function to run the script
async function main() {
    const { records } = await fundersTable.selectRecordsAsync();
    for (const record of records) {
        await processFunderRecord(record);
    }
}

// execute main function
await main();