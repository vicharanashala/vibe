import { IQuestion, ISOLSolution, ISMLSolution, IOTLSolution } from "../../../shared/interfaces/quiz";

const NATquestionData: IQuestion = {
	text: 'What is the value of <QParam>x</QParam> + <QParam>y</QParam>?',
	type: 'NUMERIC_ANSWER_TYPE',
	points: 5,
	timeLimitSeconds: 30,
	isParameterized: true,
	parameters: [
		{ name: 'x', possibleValues: ['2', '3'], type: 'number' },
		{ name: 'y', possibleValues: ['5', '7'], type: 'number' },
	],
	hint: 'Add <QParam>x</QParam> and <QParam>y</QParam>.',
};
const NATsolution = {
	decimalPrecision: 0,
	upperLimit: 20,
	lowerLimit: 0,
	expression: 'x+y',
};

const SOLquestionData: IQuestion = {
	text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
	type: 'SELECT_ONE_IN_LOT',
	points: 10,
	timeLimitSeconds: 60,
	isParameterized: true,
	parameters: [
		{ name: 'a', possibleValues: ['20', '10'], type: 'number' },
		{ name: 'b', possibleValues: ['1', '2', '3', '4.5', '7'], type: 'number' },
		{ name: 'name', possibleValues: ['John', 'Doe'], type: 'string' },
		{ name: 'name2', possibleValues: ['Kalix', 'Danny'], type: 'string' },
	],
	hint: 'This is a hint for <QParam>name</QParam> and <QParam>name2</QParam>',
};
const SOLsolution: ISOLSolution = {
	correctLotItem: {
		text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
		explaination: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
	},
	incorrectLotItems: [
		{
			text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>',
			explaination: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
		},
		{
			text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>',
			explaination: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
		},
	],
};

const SMLquestionData: IQuestion = {
	text: 'Select all correct options: <QParam>animal</QParam>, <QParam>color</QParam>',
	type: 'SELECT_MANY_IN_LOT',
	points: 15,
	timeLimitSeconds: 90,
	isParameterized: true,
	parameters: [
		{ name: 'animal', possibleValues: ['Dog', 'Cat'], type: 'string' },
		{ name: 'color', possibleValues: ['Red', 'Blue'], type: 'string' },
	],
	hint: 'Pick all that apply to <QParam>animal</QParam> and <QParam>color</QParam>',
};
const SMLsolution: ISMLSolution = {
	correctLotItems: [
		{
			text: 'Correct: <QParam>animal</QParam>',
			explaination: 'This is a correct animal: <QParam>animal</QParam>',
		},
		{
			text: 'Correct color: <QParam>color</QParam>',
			explaination: 'This is a correct color: <QParam>color</QParam>',
		},
	],
	incorrectLotItems: [
		{
			text: 'Incorrect option',
			explaination: 'This is not correct',
		},
	],
};

const OTLquestionData: IQuestion = {
	text: 'Arrange the following in correct order: <QParam>step1</QParam>, <QParam>step2</QParam>, <QParam>step3</QParam>, <QParam>step4</QParam>, <QParam>step5</QParam>',
	type: 'ORDER_THE_LOTS',
	points: 25,
	timeLimitSeconds: 180,
	isParameterized: true,
	parameters: [
		{
			name: 'step1',
			possibleValues: ['Wake up', 'Alarm Sounds'],
			type: 'string',
		},
		{
			name: 'step2',
			possibleValues: ['Brush teeth', 'Rinse mouth'],
			type: 'string',
		},
		{
			name: 'step3',
			possibleValues: ['Take a shower', 'Wash hair'],
			type: 'string',
		},
		{
			name: 'step4',
			possibleValues: ['Eat breakfast', 'Drink coffee'],
			type: 'string',
		},
		{
			name: 'step5',
			possibleValues: ['Go to school', 'Leave home'],
			type: 'string',
		},
	],
	hint: 'Put all the steps in the correct order: <QParam>step1</QParam> to <QParam>step5</QParam>',
};
const OTLsolution: IOTLSolution = {
	ordering: [
		{
			lotItem: {
				text: 'Step 1: <QParam>step1</QParam>',
				explaination: 'This is the first step: <QParam>step1</QParam>',
			},
			order: 1,
		},
		{
			lotItem: {
				text: 'Step 2: <QParam>step2</QParam>',
				explaination: 'This is the second step: <QParam>step2</QParam>',
			},
			order: 2,
		},
		{
			lotItem: {
				text: 'Step 3: <QParam>step3</QParam>',
				explaination: 'This is the third step: <QParam>step3</QParam>',
			},
			order: 3,
		},
		{
			lotItem: {
				text: 'Step 4: <QParam>step4</QParam>',
				explaination: 'This is the fourth step: <QParam>step4</QParam>',
			},
			order: 4,
		},
		{
			lotItem: {
				text: 'Step 5: <QParam>step5</QParam>',
				explaination: 'This is the fifth step: <QParam>step5</QParam>',
			},
			order: 5,
		},
	],
};

const DESquestionData: IQuestion = {
	text: 'Describe <QParam>process</QParam>.',
	type: 'DESCRIPTIVE',
	points: 5,
	timeLimitSeconds: 30,
	isParameterized: true,
	parameters: [
		{ name: 'process', possibleValues: ['compiling', 'generating machine code'], type: 'string' },
	],
	hint: 'Describe the process.',
};
const DESsolution = {
	solutionText: 'The process of <QParam>process</QParam> involves ...',
};

export {NATquestionData, NATsolution, SOLquestionData, SOLsolution, SMLquestionData, SMLsolution, OTLquestionData, OTLsolution, DESquestionData, DESsolution};