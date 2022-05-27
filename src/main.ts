import * as w4 from "./wasm4";

const FPS:i16 = 60;
const SCREEN_SIZE: i16 = 160;
const BG_TILE_SIZE:i16 = 3;
const BG_TILES:i16 = SCREEN_SIZE/BG_TILE_SIZE;
const TILES:i16 = 16;
const TILE_SIZE:i16 = SCREEN_SIZE/TILES;

const START_LEN:i16 = 3;
const TopScorePTR = memory.data(sizeof<u16>());

function write(text: string, x:i16, y:i16, c1: u8, c2: u8=0, dx:i8=1, dy:i8=1): void {
	if(c1)
		store<u16>(w4.DRAW_COLORS, c1),
		w4.text(text, x, y);

	if(c2)
		store<u16>(w4.DRAW_COLORS, c2),
		w4.text(text, x+dx, y+dy);
}

class Point {
	constructor(
		public x: i16 = 0,
		public y: i16 = 0,
	) {}

	equals(p2: Point): bool {
		return this.x == p2.x && this.y == p2.y;
	}

	draw(c1:u8=0, c2:u8=0, c3:u8=0, c4:u8=0): void {
		if(c1) store<u16>(w4.DRAW_COLORS, c1), w4.rect(
			this.x*TILE_SIZE,
			this.y*TILE_SIZE,
			TILE_SIZE,
			TILE_SIZE,
		);
		if(c2) store<u16>(w4.DRAW_COLORS, c2), w4.rect(
			this.x*TILE_SIZE+1,
			this.y*TILE_SIZE+1,
			TILE_SIZE-2*1,
			TILE_SIZE-2*1,
		);
		if(c3) store<u16>(w4.DRAW_COLORS, c3), w4.rect(
			this.x*TILE_SIZE+2,
			this.y*TILE_SIZE+2,
			TILE_SIZE-2*2,
			TILE_SIZE-2*2,
		);
		if(c4) store<u16>(w4.DRAW_COLORS, c4), w4.rect(
			this.x*TILE_SIZE+3,
			this.y*TILE_SIZE+3,
			TILE_SIZE-2*3,
			TILE_SIZE-2*3,
		);
	}
}

const DIR_RIGHT = new Point(1,0);
const DIR_UP = new Point(0,-1);
const DIR_LEFT = new Point(-1,0);
const DIR_DOWN = new Point(0,1);
const DIR_NONE = new Point(0,0);


class Snake {
	constructor(
    public parts: Array<Point> = [],
		public dir: Point = DIR_NONE,
		public nextDir: Point = DIR_NONE,
	) {}

	hasCollided(p: Point): bool {
		for (let i:i32=0; i<this.parts.length; ++i) {
			if (this.parts[i].equals(p)) {
				return true;
			}
		}
		return false;
	}

	draw(c1:u8=4, c2:u8=3, c3:u8=2, c4:u8=1): void {
		for(let i:i16=0; i<snake.parts.length; ++i) {
			snake.parts[i].draw(c1,0,0,c2);
		}
		if(snake.parts.length>0)
			snake.parts[0].draw(c1,c2,c3,c4);
	}
}

let snake = new Snake();
let apple = new Point(-1,-1);
let pause = true;
let tick = 0;
let speed = 40;
let last_button:u8=0;
let topScore: u16=0;

function randomPoint(): Point {
	return new Point(
		<i16>Math.floor(Math.random()*TILES),
		<i16>Math.floor(Math.random()*TILES),
	);
}

function randomApple(): void {
	do { apple = randomPoint(); }
	while(snake.hasCollided(apple));
}

function restart(): void {
	w4.diskr(TopScorePTR, sizeof<u16>());
	topScore = load<u16>(TopScorePTR);

	speed = 40;

	snake.parts = [];
	snake.dir = DIR_NONE;
	for(let i:i16=START_LEN; i>0; --i) {
		snake.parts.unshift(new Point(TILES/2-START_LEN/2+i,TILES/2-START_LEN/2+i));
	}

	randomApple();

	pause = true;
}

function gameOver(): void {
	w4.tone(250 | (523 << 16), 20 | (20 << 8) | (10 << 24), 30, w4.TONE_PULSE1);
	
	topScore = u16(Math.max(topScore, snake.parts.length));
	store<u16>(TopScorePTR, topScore);
	w4.diskw(TopScorePTR, sizeof<u16>());

	restart();
}

function paint(): void {
	for(let i:i16=-1; i<=BG_TILES+1; ++i)
	for(let j:i16=-1; j<=BG_TILES+1; ++j)
		store<u16>(w4.DRAW_COLORS, 2+(i+j)%2),
		w4.rect(i*BG_TILE_SIZE-BG_TILE_SIZE/2, j*BG_TILE_SIZE-BG_TILE_SIZE/2, BG_TILE_SIZE, BG_TILE_SIZE);

	let score = snake.parts.length;
	write(
		"Speed:" + speed.toString() +
		"  " +
		"Top:" + u16(Math.max(score, topScore)).toString() +
		"\n" +
		"Score:" + score.toString()
		, 6, 6 , 4 , 1);
	
	if(snake.dir.x!=0 || snake.dir.y!=0)
		apple.draw(0,4,1,2);
	snake.draw(4,3,2,1);

	if(pause)
		write("Pause", 60, 60 , 4 , 1);
}

export function start(): void {
	restart();
}

export function update (): void {
	Math.random(); // randomize (with help of user events)
	
	speed = i32(Math.min(FPS*0.9, 40 + Math.log(snake.parts.length)));
	tick = ((tick-1%(60-speed))+(60-speed))%(60-speed);
	paint();
	
	const head = snake.parts[0];
	const tail = snake.parts[snake.parts.length-1];

	const gamepad = load<u8>(w4.GAMEPAD1);
	if(last_button != gamepad){
		last_button = gamepad;
		if (gamepad & w4.BUTTON_2) {
			pause = true;
		} else if (gamepad & w4.BUTTON_1) {
			w4.tone(250 | (523 << 16), 20 | (20 << 8) | (10 << 24), 30, w4.TONE_PULSE1);
			snake.parts.push(tail); // cheating extend the size of snake
		} else if (gamepad & w4.BUTTON_UP && !snake.dir.equals(DIR_DOWN)) {
			pause = false;
			snake.nextDir = DIR_UP;
		} else if (gamepad & w4.BUTTON_DOWN && !snake.dir.equals(DIR_UP)) {
			pause = false;
			snake.nextDir = DIR_DOWN;
		} else if (gamepad & w4.BUTTON_LEFT && !snake.dir.equals(DIR_RIGHT)) {
			pause = false;
			snake.nextDir = DIR_LEFT;
		} else if (gamepad & w4.BUTTON_RIGHT && !snake.dir.equals(DIR_LEFT)) {
			pause = false;
			snake.nextDir = DIR_RIGHT;
		}
	}
	
	if(!pause && snake.dir.x==0 && snake.dir.y==0) {
		restart();
		pause = false;
	}

	if(pause || tick!=0) {
		return;
	}

	snake.dir = snake.nextDir;
	let newHead = new Point(
		(((head.x + snake.dir.x) % TILES)+TILES)%TILES,
		(((head.y + snake.dir.y) % TILES)+TILES)%TILES,
	);
	
	if(snake.hasCollided(apple)) {
		w4.tone(262, 5, 50, w4.TONE_PULSE1 | w4.TONE_MODE3);
		randomApple();
	} else {
		w4.tone(400, 1, 30, w4.TONE_TRIANGLE | w4.TONE_MODE3);
		snake.parts.pop(); // remove old tail
	}
	
	snake.hasCollided(newHead) ?
		gameOver() :
		snake.parts.unshift(newHead); // add new head
}
