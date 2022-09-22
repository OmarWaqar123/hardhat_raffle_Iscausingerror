This is the hardhat raffle smart contract . It is causing error
while writing tests for `performUpkeep ` . In the test folder and in the Rfflee.test.js file at the line number 111
you will a it with the description
`"updates the raffle state, emits an event and calls the vrf coordinate function"`. this is the it which is causing error in its 2nd last line at `119` . the error is this.

```javascript
TypeError: Cannot read properties of undefined (reading 'toNumber')
```

I've tried changing it from `toNumber()` to `toString()` but it still gives the same error with this message.

```javascript
TypeError: Cannot read properties of undefined (reading 'toString')
```

I've also tried adding `await` before `txReciept` at line no 117,
But it still gives the same error.

I don't know what is the error and how to fix it, if you have any solution to this problem then please let me know.
