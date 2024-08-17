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

// helper to get the latest filing data
function getLatestFilingData(einData) {
    if (einData.filings_with_data.length > 0 && einData.filings_without_data.length > 0) {
        let filingWithData = einData.filings_with_data[0];
        let filingWithoutData = einData.filings_without_data[0];
        return filingWithData.tax_prd_yr >= filingWithoutData.tax_prd_yr 
            ? filingWithData 
            : filingWithoutData;
    } else if (einData.filings_with_data.length > 0) {
        return einData.filings_with_data[0]
    } else if (einData.filings_without_data.length > 0) {
        return einData.filings_without_data[0]
    } else return null;
}

// function to process each record
async function processFunderRecord(record) {
    if (record.name === "") return;

    let encodedName = encodeURI(record.name).replace('-', '%20');
    let orgUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodedName}`;
    let orgData = await fetchApiData(orgUrl);

    if (orgData.total_results == 0) return;

    for (let org of orgData.organizations) {
        let newRecord = {
            'Funder': [{ id: record.id }],
            'Name': org.name,
            'EIN': org.ein,
            'Score': org.score,
            'City': org.city,
            'State': org.state,
            'NTEE Code': org.ntee
        };
        
        let einUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${org.ein}`;
        let einData = await fetchApiData(einUrl);
        let latestFiling = getLatestFilingData(einData);
        
        // need to switch based off whether latestFiling is withData or withoutData
        // AND if withData, if it is 990, 990PF, or 990EZ
        
            if (latestFiling) {
                Object.assign(newRecord, {
                    'Address': latestFiling.address,
                    'Filing Year': latestFiling.tax_prd_yr,
                    '990 Form Link': latestFiling.pdf_url
                });
            }

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