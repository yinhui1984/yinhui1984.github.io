# Evm Puzzles


EVM Puzzles挑战完成记录

<!--more-->

[EVM Puzzles](https://github.com/yinhui1984/evm-puzzles)   是对 EVM opcode阅读能力的一项挑战

比如下面的题目要求你给出正确的calldata以便程序顺利执行.

```
############
# Puzzle 8 #
############

Bytecode: 36600080373660006000F0600080808080945AF1600014601B57FD5B00

Run it in evm.codes: https://www.evm.codes/playground?codeType=Bytecode&code='36600080373660006000F0600080808080945AF1600014601B57FD5B00'_

00      36        CALLDATASIZE
01      6000      PUSH1 00
03      80        DUP1
04      37        CALLDATACOPY
05      36        CALLDATASIZE
06      6000      PUSH1 00
08      6000      PUSH1 00
0A      F0        CREATE
0B      6000      PUSH1 00
0D      80        DUP1
0E      80        DUP1
0F      80        DUP1
10      80        DUP1
11      94        SWAP5
12      5A        GAS
13      F1        CALL
14      6000      PUSH1 00
16      14        EQ
17      601B      PUSH1 1B
19      57        JUMPI
1A      FD        REVERT
1B      5B        JUMPDEST
1C      00        STOP

? Enter the calldata:
```

答案是 0x60fe6000526001601ff3, [参考这里](https://github.com/yinhui1984/evm-puzzles/blob/master/_solutions/solution_8.md)



挑战全部完成, 并将答案和解题思路放到了这里 : https://github.com/yinhui1984/evm-puzzles/tree/master/_solutions


