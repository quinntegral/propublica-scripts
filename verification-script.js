let nonprofitsTable = base.getTable("Nonprofits");

// get input variables
let config = input.config();
let funders = config.funder; // Assuming this is an array of strings representing the funder's names

// retrieve records with the same funder and unchecked "Human-Verified" field
let queryResult = await nonprofitsTable.selectRecordsAsync({
    fields: ["Funder", "Human-verified"]
});

let recordsToDelete = [];

// loop through the records and filter out the ones that should be deleted
for (let record of queryResult.records) {
    let funderField = record.getCellValue("Funder");
    let humanVerified = record.getCellValue("Human-verified");

    // check if funderField is an array and contains objects with a 'name' property
    if (Array.isArray(funderField)) {
        let funderMatch = funderField.some(f => funders.includes(f.name));
        if (funderMatch && !humanVerified) {
            recordsToDelete.push(record.id);
        }
    }
}

// delete the matching records
for (let recordId of recordsToDelete) {
    try {
        await nonprofitsTable.deleteRecordAsync(recordId);
    } catch (error) {
        console.error(`Failed to delete record with ID ${recordId}: ${error}`);
    }
}

console.log(`${recordsToDelete.length} records deleted.`);