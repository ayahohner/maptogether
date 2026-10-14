// component identifier[:definitionID][^] [{children...}]
//   position
//       visibility (? how to deal with expanding vertical space. maybe just divide all number on expansion?)
//       evolution
//   metadata
//     label position
//     description
//   future ^ (set if component name has ^ at end)
//   evolve? (really just creates a new ^ component at evolution and links, maybe remove once future ^ implemented)
//     [evolution]
//   type (only one type possible at a time. extensible with marketplace e.g. maturity mapping)
//     normal
//     activity?
//     practice?
//     data?
//     knowledge?
//     market 
//     ecosystem (ILC)
//   [xor]pipeline (sync to use of {children...})
//     [left,right] (? sync to leftmost and rightmost child?)

// edge needer.[(params...)]needed
//   metadata
//     inertia (adds a black rectangle along the line)
//     value type label? (note: value flows from needed to needer)
//     job to be done? (role)
//   type (only one type possible at a time. extensible with marketplace)
//     normal (and +)
//     constraint (<)
//     positive (*)
//     negative (/)
//   change (sync between any present/past component linked to future, display in red)


// map config /mapconfig(params...)
//   title
//   created
//   perspective
//   iteration
//   evolutionlabels
//   y-axis
//   style
//   scriptversion

// note #
// comment //


// easy access keys
// no shift ;'.,/[]\-=
// with shift :""<>?{}|

// # ways to denote component
// component apple
// c apple
// c:apple
// /apple
// -apple
// apple

// ==============================

/mapstyle(
  title="Society"
  perspective="modern society"
  created="2022-08-20 23:20 GMT+1"
  iteration=2
  evolutionlabels=genesis:10,emerging:25,converging:40,commodity:30
  y-axis
  style=wardley
  scriptversion="1.0.1"
)

// Components
government:2 [96.6,57.0](p=94,67 l=-78,1 market d="a group of people")
society:2 [89,73]
people:5 [80,71]
belonging [73.8,62.3](p=75,59 label=-78,1)
values [67.2,64.5] (label=0,-10) {
  property [65.5,70.9] (label=-24,-20)
neoliberalism [66.0,43.9] (label=-113,2)
  worker's rights [65.7,65.9]
inclusion [52.3,78.2] (label=3,15)
}
  exclusion [36.2,76.7] (label=6,12)
  unionization [51.1,60.0]

  unionization.worker's rights
law [17,72] (label=6,7)
enforcement [11,70] (label=9,9)

fairness [40.3,82.7] (label=13,8)
redistribution [46.7,69.3] (label=-81,-9)
taxation [22.2,66.7] (label=-69,5)

market [92.5,61.0] (label=-38,-10)
trade [90,64] (label=-45,12)

# NOT [41, 50]

//links
society.people
government.society
people.belonging
belonging.society
belonging.values

trade.market
trade.people
trade.property
property.exclusion
fairness.inclusion
inclusion.redistribution
redistribution.exclusion
redistribution.taxation
law.enforcement
law.exclusion
government.taxation
government.law
neoliberalism.law
neoliberalism.(d="NOT" t=constraint)taxation
taxation.law


// /lex
// # COMPONENTIDENTIFIER [digits|characters|nonspecialpunctuation]...
// # DIGITS '0', '1', '2', '3', '4', '5', '6', '7', '8', '9';
// # CHARACTERS [a-zA-Z]
// # NONSPECIAL_PUNCTUATION: '`', '~', '!', '@', '$', '%', '&', '*', '-', '_', '+', '\', '|', ';', '<', '>'
// # SPECIAL_PUNCTUATION: EDGE_JOIN, SINGLE_QUOTE, DOUBLE_QUOTE, FUTURE_SPECIFIER, DEFINITION_SPECIFIER, OPEN_PAREN, CLOSE_PAREN, OPEN_BRACE, CLOSE_BRACE,OPEN_BRACKET, CLOSE_BRACKET , NOTE, COMMAND, ASSIGN

// # NOTE '#'
// # COMMAND '/'
// # EDGE_JOIN '.'
// # ASSIGN '='
// # DEFINITON_SPECIFIER ':'
// # FUTURE_SPECIFIER '^'
// # SINGLE_QUOTE "'"
// # DOUBLE_QUOTE '""'
// # OPEN_PAREN         : '(' {this.IncIndentLevel();};
// # CLOSE_PAREN        : ')' {this.DecIndentLevel();};
// # OPEN_BRACE         : '{' {this.IncIndentLevel();};
// # CLOSE_BRACE        : '}' {this.DecIndentLevel();};
// # OPEN_BRACKET       : '[' {this.IncIndentLevel();};
// # CLOSE_BRACKET      : ']' {this.DecIndentLevel();};


// # component COMPONENTIDENTIFIER comment
// # join .[(joinparameters)]
// # parameters ([paramname[=value]]...)
// # coords [0.0,0.0]
// # pipeline/submap {[component | interfaces]...}
// # note #
// # comment (\/\/.*)?


// =============================

// user/1 (anchor evolve=0.8 inertia p=23,43 description='our most cherished customer')
// c:cuteness [need pipeline 58,34]
// user/cuteness [l='really' value=dopamine]
// c:cuteness.cat
// c:cuteness.dog

// c:food
// cuteness/food
// cuteness.cat


// c:client
// c:dog

// ==============================

// // component dog -c 23,34 -p

// // .business
// // .public
// // .business>refreshment

// // component apple 20, 30
// // component 23 
// // component(xpipeline[20,80]) refreshing beverage[20, 60] 
// // component(pipeline[30,50]) 

// // cup of tea->tea
// // tea=>tea plantation

// // refreshment.cup of tea
// // refreshment.cup of water
// // refreshment.cup of tea.tea
// // refreshment.cup of tea.cup
// // refreshment|cup


// // work and stuff
// //   work [22,32]
// //     pets [32,34]
// //   cuteness [36, 70]
// //     =pets (pipeline)
// //       cats
// //       dogs



// s.community
// s.network



// // -customer
// // --pet
// // --|dog
// // --|cat
// // ---food

// // --|dog 
// // ---food
// // -----farm


// // -bananas
// //   -cork
// //   -dogs
// //     -dingos
// //     -cats
// //       -apple computers
// // -dogs
// // --cats


// u(client)
// n(apples)
// c(money)
// c(car)
// c(grocery store)
// c(apple farm)
// 111
// 010
// 001
// 000

// if -a 
// =client [32, 34]
// =dog breath [23, 43]
// =dog food -evolved

// :dog arf.1 23,34

// =client [99, 43]
// p client [25, 55]
// =wellbeing [91, 67]
// =emotional expression [69, 25] (label=19, -10)
// =healthy belief systems [69, 68] (label=17, -20)
// =habits [47, 56] (label=11, -10)
// =exercise [29, 53]
// =diet [31, 63]
// =self care [27, 41]
// client->wellbeing
// wellbeing->emotional expression
// wellbeing->healthy belief systems
// wellbeing->habits
// habits->diet
// habits->exercise
// habits->self care
// =trauma awareness [58, 66] (label=34, -16)
// healthy belief systems->trauma awareness
// =Intergenerational Trauma Transfer [44, 69] (label=26, -20)

// trauma awareness->Intergenerational Trauma Transfer
// =brain awareness [67, 48]
// wellbeing->brain awareness
// =anger [49, 08] (label=-34, -7)
// emotional expression->anger 


// c wellbeing 

// title society
// evolution genesis / concept -> custom / emerging -> product / converging -> commodity / accepted
// style wardley

// c:government [94, 67] (l=-44,-13)
// c:society [p=89,70 l=10,-1]
// c:values [pipeline p=67,63 l=0,-10] {
//   c:property [p=65]
//   c:fairness []
// }

// /government [94, 67] (l=-44,-13 pipeline inertia=80 evolve=90)

// c government
// c society





// a
//   b
//     c
//       e
// aa
//   b
// d
//   b


// user
//   cup of tea
//     cup
//     milk
//     pour
//       barista
//       brew
//         tea
//         hot water
//           water
//           kettle
//             barista
//             power