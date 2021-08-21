[//]: # (SPDX-License-Identifier: CC-BY-4.0)

# Hyperledger Fabric Test

This is a fork of https://github.com/hyperledger/fabric-samples that my classmate Akshar and I used to run some performance tests in different scenarios on Hyperledger Fabric's test network. The test code can be found in fabric-test/ds-benchmark-tests; we used Node.js to send requests to Hyperledger and time responses to those requests in various scenarios. These tests were pretty basic, and ideally we would like to create a larger network with more peers in each organization, and consensus and gossip algorithms, to be able to really measure the peformance of Hyperledger in an enterprise setting. In addition, with more nodes we would like to evaluate the performnce of Fabric when dealing with Byzantine faults in both the ordering and committing steps.
