/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Basic benchmarking tests for the Hyperledger Fabric test network. Here, I basically just measure time to response for 
 * each of the transactions in the original 'asset-transfer-basic' JavaScript application provided by IBM.
*/

/**
 * Testing mixed but ordered reads and writes in Hyperledger Fabric
 */


'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');

const channelName = 'mychannel';
const chaincodeName = 'basic';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUser';

const {performance} = require('perf_hooks');

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { totalmem } = require('os');

const csvWriterReads = createCsvWriter({
  path: 'read-write_test_reads.csv',
  header: [
    {id: 'startTime', title: 'T'},
    {id: 'responseTime', title: 'Response Time'}
  ]
});

const csvWriterWrites = createCsvWriter({
	path: 'read-write_test_writes.csv',
	header: [
	  {id: 'startTime', title: 'T'},
	  {id: 'responseTime', title: 'Response Time'}
	]
  });


function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

const measurePromise = async (promFunc) => {
    const start = performance.now();
    const returnValue = await promFunc();
    return {
        value: returnValue,
        elapsed: performance.now() - start,
		start: start
    }
}

async function main() {
	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg1();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		await enrollAdmin(caClient, wallet, mspOrg1);

		// in a real application this would be done only when a new user was required to be added
		// and would be part of an administrative flow
		await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

		// Create a new gateway instance for interacting with the fabric network.
		// In a real application this would be done as the backend server session is setup for
		// a user that has been verified.
		const gateway = new Gateway();

		try {
			// setup the gateway instance
			// The user will now be able to create connections to the fabric network and be able to
			// submit transactions and query. All transactions submitted by this gateway will be
			// signed by this user using the credentials stored in the wallet.
			await gateway.connect(ccp, {
				wallet,
				identity: org1UserId,
				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
			});

			// Build a network instance based on the channel where the smart contract is deployed
			const network = await gateway.getNetwork(channelName);

			// Get the contract from the network.
			const contract = network.getContract(chaincodeName);

			// Initialize a set of asset data on the channel using the chaincode 'InitLedger' function.
			// This type of transaction would only be run once by an application the first time it was started after it
			// deployed the first time. Any updates to the chaincode deployed later would likely not need to run
			// an "init" type function.
			console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
			await contract.submitTransaction('InitLedger');
			console.log('*** Result: committed');


			//Test reading larger dataset a bunch of times
			var totalTimeReads = 0;
			var totalTimeWrites = 0;
			/**
			 * Format of output data: [ {startTime: <start time of transaction>, responseTime: <time for call to resolve>}, {...}, {...}]
			 */
			var output_data_reads = [];
			var output_data_writes = [];

			const numIterations = 50;

			console.log('Starting script to write and read assets... ');
			for (let i = 0; i < numIterations; i++){
				await measurePromise(() => contract.submitTransaction('GetAllAssets'))
				.then((response) => {
					output_data_reads.push({startTime: response.start, responseTime: response.elapsed});
					totalTimeReads += response.elapsed;
					console.log(`*** READ Result - GetAllAssets:  ${prettyJSONString(response.value.toString())}`);
				});

				await measurePromise(() => contract.submitTransaction('UpdateAsset', 'asset1', 'blue', i.toString(), 'Tomoko', '350'))
				.then((response) => {
					output_data_writes.push({startTime: response.start, responseTime: response.elapsed});
					totalTimeWrites += response.elapsed;
					console.log(`*** WRITE Result - UpdateAsset:  ${prettyJSONString(response.value.toString())}`);
				});
			}

			var averageTimeReads = totalTimeReads / numIterations;
			var averageTimeWrites = totalTimeWrites / numIterations;

			console.log(`Average time for large data reads: ${averageTimeReads}`);
			console.log(`Average time for writes: ${averageTimeWrites}`);

			csvWriterReads
  				.writeRecords(output_data_reads)
  				.then(()=> console.log('The Read CSV file was written successfully'));

			csvWriterWrites
				.writeRecords(output_data_writes)
				.then(() => console.log('The Write CSV file was written successfully'));

		}
		finally {
			// Disconnect from the gateway when the application is closing
			// This will close all connections to the network
			gateway.disconnect();
		}
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
	}
}

main()