# Geometrie Dash · Neubaustand

13 Level, Physik, Bot, Audit, build.

## Pruefen

    node test/suite.js         # 13 Level: Bot, Audit, Zielfenster
    node test/buendel.js       # das ausgelieferte dist/gd.html
    node test/negitivprobe.js  # 11 Prove: melden die Tests ueberhaupt?

## Bauen

    node werkzeug/build.js     # schreibt dist/gd.html (ein File, offline)

Die Terminalumgebung ist fluechtig. dist/gd.html jeweils im Chat ausgeben und
pushen, nicht nur in /tmp sichern.
