# base→seed0 sweep (propagation only)

Claim: dependency propagation — NOT RML materialization.

CREATE semantics: `gtfs.idx` membership + parent `*Count` sum aggregates (slot 0→1).
Calendar: `active` derived from mon–sun + numeric start/end dates.

| metric | value |
|---|---|
| measured N | 151 |
| skipped | 0 |
| CREATE/UPDATE/DELETE | 111/7/33 |
| loadMs | 332.27 |
| k mean / p50 / p95 / max | 5.106 / 1 / 18.500 / 27 |
| k CREATE mean/p50/max | 1 / 1 / 1 (n=111) |
| k UPDATE mean/p50/max | 12.143 / 1 / 27 (n=7) |
| k DELETE mean/p50/max | 17.424 / 18 / 19 (n=33) |
| recomputeMs p50 / p95 / p99 | 0.004 / 0.073 / 0.079 |
| applyMs p50 / p95 / p99 | 0.140 / 5.918 / 6.649 |
| total recomputed / changed / unchanged | 771 / 767 / 4 |
| early-cutoff (unchanged/recomputed) | 0.0052 |

## Per-mutation (sorted by k desc)

| type | kind | id | field | k | recomputed | changed | unchanged | applyMs | recomputeMs | sourcePath |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| UPDATE | service | 00000000000000000003 | monday | 27 | 27 | 27 | 0 | 0.996 | 0.083 | gtfs.services.n3.monday |
| UPDATE | service | 00000000000000000003 | startDate | 27 | 27 | 27 | 0 | 0.487 | 0.064 | gtfs.services.n3.startDate |
| UPDATE | service | 00000000000000000003 | endDate | 27 | 27 | 27 | 0 | 0.461 | 0.064 | gtfs.services.n3.endDate |
| DELETE | trip | 00000000000000000033 |  | 19 | 19 | 19 | 0 | 5.652 | 0.062 | gtfs.trips.n51.routeId |
| DELETE | trip | 00000000000000000014 |  | 19 | 19 | 19 | 0 | 6.423 | 0.074 | gtfs.trips.n20.routeId |
| DELETE | trip | 0000000000000000002q |  | 19 | 19 | 19 | 0 | 6.637 | 0.075 | gtfs.trips.n168354133.routeId |
| DELETE | trip | 0000000000000000002d |  | 19 | 19 | 19 | 0 | 6.975 | 0.066 | gtfs.trips.n45.routeId |
| DELETE | trip | 0000000000000000000b |  | 19 | 19 | 19 | 0 | 6.139 | 0.067 | gtfs.trips.n11.routeId |
| DELETE | trip | 00000000000000000005 |  | 18 | 18 | 18 | 0 | 6.661 | 0.063 | gtfs.trips.n5.routeId |
| DELETE | trip | 0000000000000000003m |  | 18 | 18 | 18 | 0 | 5.873 | 0.075 | gtfs.trips.n302427990.routeId |
| DELETE | trip | 0000000000000000001g |  | 18 | 18 | 18 | 0 | 5.665 | 0.071 | gtfs.trips.n134254442.routeId |
| DELETE | trip | 0000000000000000003d |  | 18 | 18 | 18 | 0 | 5.864 | 0.079 | gtfs.trips.n61.routeId |
| DELETE | trip | 0000000000000000003b |  | 18 | 18 | 18 | 0 | 5.962 | 0.072 | gtfs.trips.n59.routeId |
| DELETE | trip | 0000000000000000001n |  | 18 | 18 | 18 | 0 | 5.413 | 0.067 | gtfs.trips.n251697775.routeId |
| DELETE | trip | 00000000000000000012 |  | 18 | 18 | 18 | 0 | 5.471 | 0.072 | gtfs.trips.n18.routeId |
| DELETE | trip | 0000000000000000002v |  | 18 | 18 | 18 | 0 | 5.595 | 0.073 | gtfs.trips.n151576514.routeId |
| DELETE | trip | 00000000000000000017 |  | 18 | 18 | 18 | 0 | 5.639 | 0.073 | gtfs.trips.n23.routeId |
| DELETE | trip | 0000000000000000000a |  | 18 | 18 | 18 | 0 | 5.867 | 0.064 | gtfs.trips.n10.routeId |
| DELETE | trip | 0000000000000000002t |  | 18 | 18 | 18 | 0 | 6.463 | 0.059 | gtfs.trips.n118021276.routeId |
| DELETE | trip | 0000000000000000003c |  | 18 | 18 | 18 | 0 | 5.410 | 0.075 | gtfs.trips.n60.routeId |
| DELETE | trip | 0000000000000000003g |  | 18 | 18 | 18 | 0 | 5.182 | 0.056 | gtfs.trips.n403093704.routeId |
| DELETE | trip | 00000000000000000025 |  | 18 | 18 | 18 | 0 | 5.225 | 0.055 | gtfs.trips.n37.routeId |
| DELETE | trip | 00000000000000000015 |  | 18 | 18 | 18 | 0 | 5.363 | 0.055 | gtfs.trips.n21.routeId |
| DELETE | trip | 0000000000000000002u |  | 18 | 18 | 18 | 0 | 5.105 | 0.056 | gtfs.trips.n101243657.routeId |
| DELETE | trip | 0000000000000000003h |  | 18 | 18 | 18 | 0 | 5.079 | 0.061 | gtfs.trips.n218539895.routeId |
| DELETE | trip | 0000000000000000000f |  | 18 | 18 | 18 | 0 | 5.873 | 0.063 | gtfs.trips.n15.routeId |
| DELETE | trip | 0000000000000000000k |  | 18 | 18 | 18 | 0 | 5.493 | 0.059 | gtfs.trips.n1798952325.routeId |
| DELETE | trip | 00000000000000000022 |  | 18 | 18 | 18 | 0 | 5.518 | 0.061 | gtfs.trips.n34.routeId |
| DELETE | trip | 0000000000000000002o |  | 18 | 18 | 18 | 0 | 5.360 | 0.068 | gtfs.trips.n1732136039.routeId |
| DELETE | trip | 0000000000000000000l |  | 18 | 18 | 18 | 0 | 5.782 | 0.073 | gtfs.trips.n1782174706.routeId |
| DELETE | trip | 0000000000000000001y |  | 18 | 18 | 18 | 0 | 5.471 | 0.065 | gtfs.trips.n33588728.routeId |
| DELETE | trip | 00000000000000000029 |  | 18 | 18 | 18 | 0 | 5.569 | 0.079 | gtfs.trips.n41.routeId |
| DELETE | trip | 0000000000000000000q |  | 18 | 18 | 18 | 0 | 5.427 | 0.067 | gtfs.trips.n1966728515.routeId |
| DELETE | route | 0000000000000000000c |  | 10 | 10 | 10 | 0 | 6.279 | 0.037 | gtfs.routes.n12.active |
| DELETE | route | 00000000000000000008 |  | 10 | 10 | 10 | 0 | 5.566 | 0.029 | gtfs.routes.n8.active |
| DELETE | route | 00000000000000000007 |  | 10 | 10 | 10 | 0 | 5.088 | 0.040 | gtfs.routes.n7.active |
| UPDATE | service | 00000000000000000003 | tuesday | 1 | 1 | 0 | 1 | 0.199 | 0.073 | gtfs.services.n3.tuesday |
| UPDATE | service | 00000000000000000003 | wednesday | 1 | 1 | 0 | 1 | 0.183 | 0.066 | gtfs.services.n3.wednesday |
| UPDATE | service | 00000000000000000003 | thursday | 1 | 1 | 0 | 1 | 0.183 | 0.066 | gtfs.services.n3.thursday |
| UPDATE | service | 00000000000000000003 | friday | 1 | 1 | 0 | 1 | 0.212 | 0.066 | gtfs.services.n3.friday |
| CREATE | service | SERVICE00 |  | 1 | 1 | 1 | 0 | 0.232 | 0.003 | gtfs.idx.serviceMember.n242928581 |
| CREATE | service | SERVICE01 |  | 1 | 1 | 1 | 0 | 0.284 | 0.005 | gtfs.idx.serviceMember.n259706200 |
| CREATE | service | SERVICE02 |  | 1 | 1 | 1 | 0 | 0.326 | 0.005 | gtfs.idx.serviceMember.n276483819 |
| CREATE | route | ROUTE00 |  | 1 | 1 | 1 | 0 | 0.134 | 0.003 | gtfs.idx.routeMember.n1916039695 |
| CREATE | route | ROUTE01 |  | 1 | 1 | 1 | 0 | 0.105 | 0.002 | gtfs.idx.routeMember.n1932817314 |
| CREATE | route | ROUTE02 |  | 1 | 1 | 1 | 0 | 0.104 | 0.003 | gtfs.idx.routeMember.n1882484457 |
| CREATE | trip | TRIP00 |  | 1 | 1 | 1 | 0 | 0.167 | 0.004 | gtfs.idx.routes.n1916039695.tripMember.n69849211 |
| CREATE | trip | TRIP01 |  | 1 | 1 | 1 | 0 | 0.149 | 0.003 | gtfs.idx.routes.n1916039695.tripMember.n86626830 |
| CREATE | trip | TRIP02 |  | 1 | 1 | 1 | 0 | 0.146 | 0.004 | gtfs.idx.routes.n1916039695.tripMember.n36293973 |
| CREATE | trip | TRIP03 |  | 1 | 1 | 1 | 0 | 0.140 | 0.003 | gtfs.idx.routes.n1916039695.tripMember.n53071592 |
| CREATE | trip | TRIP04 |  | 1 | 1 | 1 | 0 | 0.153 | 0.003 | gtfs.idx.routes.n1916039695.tripMember.n2738735 |
| CREATE | trip | TRIP05 |  | 1 | 1 | 1 | 0 | 0.139 | 0.003 | gtfs.idx.routes.n1916039695.tripMember.n19516354 |
| CREATE | trip | TRIP06 |  | 1 | 1 | 1 | 0 | 0.145 | 0.003 | gtfs.idx.routes.n1916039695.tripMember.n1969183497 |
| CREATE | trip | TRIP07 |  | 1 | 1 | 1 | 0 | 0.153 | 0.005 | gtfs.idx.routes.n1916039695.tripMember.n1985961116 |
| CREATE | trip | TRIP08 |  | 1 | 1 | 1 | 0 | 0.190 | 0.004 | gtfs.idx.routes.n1932817314.tripMember.n1935628259 |
| CREATE | trip | TRIP09 |  | 1 | 1 | 1 | 0 | 0.149 | 0.004 | gtfs.idx.routes.n1932817314.tripMember.n1952405878 |
| CREATE | trip | TRIP010 |  | 1 | 1 | 1 | 0 | 0.155 | 0.004 | gtfs.idx.routes.n1932817314.tripMember.n961567240 |
| CREATE | trip | TRIP011 |  | 1 | 1 | 1 | 0 | 0.169 | 0.005 | gtfs.idx.routes.n1932817314.tripMember.n944789621 |
| CREATE | trip | TRIP012 |  | 1 | 1 | 1 | 0 | 0.155 | 0.003 | gtfs.idx.routes.n1932817314.tripMember.n995122478 |
| CREATE | trip | TRIP013 |  | 1 | 1 | 1 | 0 | 0.155 | 0.003 | gtfs.idx.routes.n1932817314.tripMember.n978344859 |
| CREATE | trip | TRIP014 |  | 1 | 1 | 1 | 0 | 0.147 | 0.003 | gtfs.idx.routes.n1932817314.tripMember.n894456764 |
| CREATE | trip | TRIP015 |  | 1 | 1 | 1 | 0 | 0.148 | 0.003 | gtfs.idx.routes.n1932817314.tripMember.n877679145 |
| CREATE | trip | TRIP016 |  | 1 | 1 | 1 | 0 | 0.150 | 0.003 | gtfs.idx.routes.n1932817314.tripMember.n928012002 |
| CREATE | trip | TRIP017 |  | 1 | 1 | 1 | 0 | 0.528 | 0.008 | gtfs.idx.routes.n1932817314.tripMember.n911234383 |
| CREATE | trip | TRIP018 |  | 1 | 1 | 1 | 0 | 0.169 | 0.004 | gtfs.idx.routes.n1932817314.tripMember.n827346288 |
| CREATE | trip | TRIP019 |  | 1 | 1 | 1 | 0 | 0.127 | 0.003 | gtfs.idx.routes.n1882484457.tripMember.n810568669 |
| CREATE | trip | TRIP020 |  | 1 | 1 | 1 | 0 | 0.119 | 0.004 | gtfs.idx.routes.n1882484457.tripMember.n511593581 |
| CREATE | stopTime | TRIP00||STOP00 |  | 1 | 1 | 1 | 0 | 0.132 | 0.004 | gtfs.idx.trips.n69849211.stopTimeMember.n69849211_0_STOP00 |
| CREATE | stopTime | TRIP00||STOP01 |  | 1 | 1 | 1 | 0 | 0.096 | 0.003 | gtfs.idx.trips.n69849211.stopTimeMember.n69849211_0_STOP01 |
| CREATE | stopTime | TRIP01||STOP02 |  | 1 | 1 | 1 | 0 | 0.109 | 0.003 | gtfs.idx.trips.n86626830.stopTimeMember.n86626830_0_STOP02 |
| CREATE | stopTime | TRIP01||STOP03 |  | 1 | 1 | 1 | 0 | 0.103 | 0.004 | gtfs.idx.trips.n86626830.stopTimeMember.n86626830_0_STOP03 |
| CREATE | stopTime | TRIP02||STOP04 |  | 1 | 1 | 1 | 0 | 0.150 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP04 |
| CREATE | stopTime | TRIP02||STOP05 |  | 1 | 1 | 1 | 0 | 0.121 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP05 |
| CREATE | stopTime | TRIP02||STOP06 |  | 1 | 1 | 1 | 0 | 0.161 | 0.005 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP06 |
| CREATE | stopTime | TRIP02||STOP07 |  | 1 | 1 | 1 | 0 | 0.135 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP07 |
| CREATE | stopTime | TRIP02||STOP08 |  | 1 | 1 | 1 | 0 | 0.135 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP08 |
| CREATE | stopTime | TRIP02||STOP09 |  | 1 | 1 | 1 | 0 | 0.136 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP09 |
| CREATE | stopTime | TRIP02||STOP010 |  | 1 | 1 | 1 | 0 | 0.131 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP010 |
| CREATE | stopTime | TRIP02||STOP011 |  | 1 | 1 | 1 | 0 | 0.130 | 0.004 | gtfs.idx.trips.n36293973.stopTimeMember.n36293973_0_STOP011 |
| CREATE | stopTime | TRIP03||STOP012 |  | 1 | 1 | 1 | 0 | 0.129 | 0.004 | gtfs.idx.trips.n53071592.stopTimeMember.n53071592_0_STOP012 |
| CREATE | stopTime | TRIP03||STOP013 |  | 1 | 1 | 1 | 0 | 0.116 | 0.003 | gtfs.idx.trips.n53071592.stopTimeMember.n53071592_0_STOP013 |
| CREATE | stopTime | TRIP03||STOP014 |  | 1 | 1 | 1 | 0 | 0.115 | 0.003 | gtfs.idx.trips.n53071592.stopTimeMember.n53071592_0_STOP014 |
| CREATE | stopTime | TRIP03||STOP015 |  | 1 | 1 | 1 | 0 | 0.115 | 0.003 | gtfs.idx.trips.n53071592.stopTimeMember.n53071592_0_STOP015 |
| CREATE | stopTime | TRIP03||STOP016 |  | 1 | 1 | 1 | 0 | 0.115 | 0.003 | gtfs.idx.trips.n53071592.stopTimeMember.n53071592_0_STOP016 |
| CREATE | stopTime | TRIP03||STOP017 |  | 1 | 1 | 1 | 0 | 0.113 | 0.003 | gtfs.idx.trips.n53071592.stopTimeMember.n53071592_0_STOP017 |
| CREATE | stopTime | TRIP04||STOP018 |  | 1 | 1 | 1 | 0 | 0.102 | 0.003 | gtfs.idx.trips.n2738735.stopTimeMember.n2738735_0_STOP018 |
| CREATE | stopTime | TRIP04||STOP019 |  | 1 | 1 | 1 | 0 | 0.098 | 0.003 | gtfs.idx.trips.n2738735.stopTimeMember.n2738735_0_STOP019 |
| CREATE | stopTime | TRIP05||STOP020 |  | 1 | 1 | 1 | 0 | 0.106 | 0.003 | gtfs.idx.trips.n19516354.stopTimeMember.n19516354_0_STOP020 |
| CREATE | stopTime | TRIP05||STOP021 |  | 1 | 1 | 1 | 0 | 0.100 | 0.003 | gtfs.idx.trips.n19516354.stopTimeMember.n19516354_0_STOP021 |
| CREATE | stopTime | TRIP05||STOP022 |  | 1 | 1 | 1 | 0 | 0.102 | 0.003 | gtfs.idx.trips.n19516354.stopTimeMember.n19516354_0_STOP022 |
| CREATE | stopTime | TRIP06||STOP023 |  | 1 | 1 | 1 | 0 | 0.123 | 0.004 | gtfs.idx.trips.n1969183497.stopTimeMember.n1969183497_0_STOP023 |
| CREATE | stopTime | TRIP06||STOP024 |  | 1 | 1 | 1 | 0 | 0.116 | 0.003 | gtfs.idx.trips.n1969183497.stopTimeMember.n1969183497_0_STOP024 |
| CREATE | stopTime | TRIP06||STOP025 |  | 1 | 1 | 1 | 0 | 0.120 | 0.005 | gtfs.idx.trips.n1969183497.stopTimeMember.n1969183497_0_STOP025 |
| CREATE | stopTime | TRIP06||STOP026 |  | 1 | 1 | 1 | 0 | 0.109 | 0.003 | gtfs.idx.trips.n1969183497.stopTimeMember.n1969183497_0_STOP026 |
| CREATE | stopTime | TRIP06||STOP027 |  | 1 | 1 | 1 | 0 | 0.110 | 0.003 | gtfs.idx.trips.n1969183497.stopTimeMember.n1969183497_0_STOP027 |
| CREATE | stopTime | TRIP07||STOP028 |  | 1 | 1 | 1 | 0 | 0.170 | 0.005 | gtfs.idx.trips.n1985961116.stopTimeMember.n1985961116_0_STOP028 |
| CREATE | stopTime | TRIP07||STOP029 |  | 1 | 1 | 1 | 0 | 0.135 | 0.004 | gtfs.idx.trips.n1985961116.stopTimeMember.n1985961116_0_STOP029 |
| CREATE | stopTime | TRIP07||STOP030 |  | 1 | 1 | 1 | 0 | 0.107 | 0.003 | gtfs.idx.trips.n1985961116.stopTimeMember.n1985961116_0_STOP030 |
| CREATE | stopTime | TRIP07||STOP031 |  | 1 | 1 | 1 | 0 | 0.133 | 0.004 | gtfs.idx.trips.n1985961116.stopTimeMember.n1985961116_0_STOP031 |
| CREATE | stopTime | TRIP07||STOP032 |  | 1 | 1 | 1 | 0 | 0.142 | 0.006 | gtfs.idx.trips.n1985961116.stopTimeMember.n1985961116_0_STOP032 |
| CREATE | stopTime | TRIP08||STOP033 |  | 1 | 1 | 1 | 0 | 0.220 | 0.009 | gtfs.idx.trips.n1935628259.stopTimeMember.n1935628259_0_STOP033 |
| CREATE | stopTime | TRIP08||STOP034 |  | 1 | 1 | 1 | 0 | 0.142 | 0.004 | gtfs.idx.trips.n1935628259.stopTimeMember.n1935628259_0_STOP034 |
| CREATE | stopTime | TRIP08||STOP035 |  | 1 | 1 | 1 | 0 | 0.125 | 0.004 | gtfs.idx.trips.n1935628259.stopTimeMember.n1935628259_0_STOP035 |
| CREATE | stopTime | TRIP08||STOP036 |  | 1 | 1 | 1 | 0 | 0.118 | 0.004 | gtfs.idx.trips.n1935628259.stopTimeMember.n1935628259_0_STOP036 |
| CREATE | stopTime | TRIP08||STOP037 |  | 1 | 1 | 1 | 0 | 0.132 | 0.004 | gtfs.idx.trips.n1935628259.stopTimeMember.n1935628259_0_STOP037 |
| CREATE | stopTime | TRIP08||STOP038 |  | 1 | 1 | 1 | 0 | 0.133 | 0.004 | gtfs.idx.trips.n1935628259.stopTimeMember.n1935628259_0_STOP038 |
| CREATE | stopTime | TRIP09||STOP039 |  | 1 | 1 | 1 | 0 | 0.141 | 0.004 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP039 |
| CREATE | stopTime | TRIP09||STOP040 |  | 1 | 1 | 1 | 0 | 0.142 | 0.004 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP040 |
| CREATE | stopTime | TRIP09||STOP041 |  | 1 | 1 | 1 | 0 | 0.130 | 0.004 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP041 |
| CREATE | stopTime | TRIP09||STOP042 |  | 1 | 1 | 1 | 0 | 0.142 | 0.003 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP042 |
| CREATE | stopTime | TRIP09||STOP043 |  | 1 | 1 | 1 | 0 | 0.140 | 0.005 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP043 |
| CREATE | stopTime | TRIP09||STOP044 |  | 1 | 1 | 1 | 0 | 0.135 | 0.004 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP044 |
| CREATE | stopTime | TRIP09||STOP045 |  | 1 | 1 | 1 | 0 | 0.130 | 0.004 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP045 |
| CREATE | stopTime | TRIP09||STOP046 |  | 1 | 1 | 1 | 0 | 0.115 | 0.004 | gtfs.idx.trips.n1952405878.stopTimeMember.n1952405878_0_STOP046 |
| CREATE | stopTime | TRIP010||STOP047 |  | 1 | 1 | 1 | 0 | 0.183 | 0.004 | gtfs.idx.trips.n961567240.stopTimeMember.n961567240_0_STOP047 |
| CREATE | stopTime | TRIP011||STOP048 |  | 1 | 1 | 1 | 0 | 0.134 | 0.004 | gtfs.idx.trips.n944789621.stopTimeMember.n944789621_0_STOP048 |
| CREATE | stopTime | TRIP011||STOP049 |  | 1 | 1 | 1 | 0 | 0.093 | 0.003 | gtfs.idx.trips.n944789621.stopTimeMember.n944789621_0_STOP049 |
| CREATE | stopTime | TRIP012||STOP050 |  | 1 | 1 | 1 | 0 | 0.112 | 0.003 | gtfs.idx.trips.n995122478.stopTimeMember.n995122478_0_STOP050 |
| CREATE | stopTime | TRIP012||STOP051 |  | 1 | 1 | 1 | 0 | 0.100 | 0.004 | gtfs.idx.trips.n995122478.stopTimeMember.n995122478_0_STOP051 |
| CREATE | stopTime | TRIP012||STOP052 |  | 1 | 1 | 1 | 0 | 0.101 | 0.004 | gtfs.idx.trips.n995122478.stopTimeMember.n995122478_0_STOP052 |
| CREATE | stopTime | TRIP012||STOP053 |  | 1 | 1 | 1 | 0 | 0.112 | 0.006 | gtfs.idx.trips.n995122478.stopTimeMember.n995122478_0_STOP053 |
| CREATE | stopTime | TRIP013||STOP054 |  | 1 | 1 | 1 | 0 | 0.187 | 0.004 | gtfs.idx.trips.n978344859.stopTimeMember.n978344859_0_STOP054 |
| CREATE | stopTime | TRIP013||STOP055 |  | 1 | 1 | 1 | 0 | 0.138 | 0.004 | gtfs.idx.trips.n978344859.stopTimeMember.n978344859_0_STOP055 |
| CREATE | stopTime | TRIP013||STOP056 |  | 1 | 1 | 1 | 0 | 0.132 | 0.017 | gtfs.idx.trips.n978344859.stopTimeMember.n978344859_0_STOP056 |
| CREATE | stopTime | TRIP013||STOP057 |  | 1 | 1 | 1 | 0 | 0.106 | 0.004 | gtfs.idx.trips.n978344859.stopTimeMember.n978344859_0_STOP057 |
| CREATE | stopTime | TRIP013||STOP058 |  | 1 | 1 | 1 | 0 | 0.108 | 0.004 | gtfs.idx.trips.n978344859.stopTimeMember.n978344859_0_STOP058 |
| CREATE | stopTime | TRIP013||STOP059 |  | 1 | 1 | 1 | 0 | 0.109 | 0.004 | gtfs.idx.trips.n978344859.stopTimeMember.n978344859_0_STOP059 |
| CREATE | stopTime | TRIP014||STOP060 |  | 1 | 1 | 1 | 0 | 0.140 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP060 |
| CREATE | stopTime | TRIP014||STOP061 |  | 1 | 1 | 1 | 0 | 0.122 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP061 |
| CREATE | stopTime | TRIP014||STOP062 |  | 1 | 1 | 1 | 0 | 0.116 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP062 |
| CREATE | stopTime | TRIP014||STOP063 |  | 1 | 1 | 1 | 0 | 0.129 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP063 |
| CREATE | stopTime | TRIP014||STOP064 |  | 1 | 1 | 1 | 0 | 0.133 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP064 |
| CREATE | stopTime | TRIP014||STOP065 |  | 1 | 1 | 1 | 0 | 0.131 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP065 |
| CREATE | stopTime | TRIP014||STOP066 |  | 1 | 1 | 1 | 0 | 0.154 | 0.004 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP066 |
| CREATE | stopTime | TRIP014||STOP067 |  | 1 | 1 | 1 | 0 | 0.154 | 0.013 | gtfs.idx.trips.n894456764.stopTimeMember.n894456764_0_STOP067 |
| CREATE | stopTime | TRIP015||STOP068 |  | 1 | 1 | 1 | 0 | 0.119 | 0.004 | gtfs.idx.trips.n877679145.stopTimeMember.n877679145_0_STOP068 |
| CREATE | stopTime | TRIP015||STOP069 |  | 1 | 1 | 1 | 0 | 0.104 | 0.003 | gtfs.idx.trips.n877679145.stopTimeMember.n877679145_0_STOP069 |
| CREATE | stopTime | TRIP016||STOP070 |  | 1 | 1 | 1 | 0 | 0.112 | 0.003 | gtfs.idx.trips.n928012002.stopTimeMember.n928012002_0_STOP070 |
| CREATE | stopTime | TRIP016||STOP071 |  | 1 | 1 | 1 | 0 | 0.108 | 0.003 | gtfs.idx.trips.n928012002.stopTimeMember.n928012002_0_STOP071 |
| CREATE | stopTime | TRIP016||STOP072 |  | 1 | 1 | 1 | 0 | 0.106 | 0.003 | gtfs.idx.trips.n928012002.stopTimeMember.n928012002_0_STOP072 |
| CREATE | stopTime | TRIP017||STOP073 |  | 1 | 1 | 1 | 0 | 0.130 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP073 |
| CREATE | stopTime | TRIP017||STOP074 |  | 1 | 1 | 1 | 0 | 0.122 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP074 |
| CREATE | stopTime | TRIP017||STOP075 |  | 1 | 1 | 1 | 0 | 0.117 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP075 |
| CREATE | stopTime | TRIP017||STOP076 |  | 1 | 1 | 1 | 0 | 0.117 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP076 |
| CREATE | stopTime | TRIP017||STOP077 |  | 1 | 1 | 1 | 0 | 0.126 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP077 |
| CREATE | stopTime | TRIP017||STOP078 |  | 1 | 1 | 1 | 0 | 0.116 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP078 |
| CREATE | stopTime | TRIP017||STOP079 |  | 1 | 1 | 1 | 0 | 0.118 | 0.003 | gtfs.idx.trips.n911234383.stopTimeMember.n911234383_0_STOP079 |
| CREATE | stopTime | TRIP018||STOP080 |  | 1 | 1 | 1 | 0 | 0.098 | 0.003 | gtfs.idx.trips.n827346288.stopTimeMember.n827346288_0_STOP080 |
| CREATE | stopTime | TRIP019||STOP081 |  | 1 | 1 | 1 | 0 | 0.109 | 0.003 | gtfs.idx.trips.n810568669.stopTimeMember.n810568669_0_STOP081 |
| CREATE | stopTime | TRIP020||STOP082 |  | 1 | 1 | 1 | 0 | 0.092 | 0.003 | gtfs.idx.trips.n511593581.stopTimeMember.n511593581_0_STOP082 |
| CREATE | stopTime | TRIP020||STOP083 |  | 1 | 1 | 1 | 0 | 0.086 | 0.003 | gtfs.idx.trips.n511593581.stopTimeMember.n511593581_0_STOP083 |
