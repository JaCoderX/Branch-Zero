extends Node
## Audio — SFX placeholders for the "feedback and juice" table (docs/GAME-DESIGN.md §8), U7 early art step 4.
## Kenney CC0 one-shots (assets/audio/kenney, see CREDITS.md), played quietly on real desk events only:
##   stage signing → stamp · broadcasting → printer · mined / pending → split-flap clack · released → vault bolt ·
##   cancelled → shredder · a refused action → soft buzzer. No music, no loops, nothing on a timer — a sound only
##   follows a bridge event or a dialogue result, so the mock and the real bridge sound the same.
## Web: the browser unmutes the AudioContext on the first input, which every one of these follows anyway.

const CLIPS := {
	"stamp": "res://assets/audio/kenney/stamp.ogg",
	"printer": "res://assets/audio/kenney/printer.ogg",
	"flap": "res://assets/audio/kenney/flap.ogg",
	"bolt": "res://assets/audio/kenney/bolt.ogg",
	"shredder": "res://assets/audio/kenney/shredder.ogg",
	"buzzer": "res://assets/audio/kenney/buzzer.ogg",
}
const VOLUME_DB := -14.0
const VOICES := 4

var enabled: bool = true
var _streams: Dictionary = {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0
var _last_key := ""
var _last_at := 0.0


func _ready() -> void:
	for k in CLIPS.keys():
		var s := load(CLIPS[k])
		if s != null:
			_streams[k] = s
	for i in VOICES:
		var p := AudioStreamPlayer.new()
		p.volume_db = VOLUME_DB
		add_child(p)
		_players.append(p)
	GameState.stage.connect(_on_stage)
	Dialogue.action_finished.connect(func(_id: String, ok: bool) -> void:
		if not ok:
			play("buzzer"))


func play(key: String) -> void:
	if not enabled or not _streams.has(key):
		return
	var t := Time.get_ticks_msec() / 1000.0
	if key == _last_key and t - _last_at < 0.25:
		return   # the same event twice in a burst (stage + reconcile) is one sound
	_last_key = key
	_last_at = t
	var p := _players[_next % VOICES]
	_next += 1
	p.stream = _streams[key]
	p.pitch_scale = randf_range(0.96, 1.04)
	p.play()


func _on_stage(ev: Dictionary) -> void:
	var st := str(ev.get("stage", ""))
	match st:
		"signing":
			play("stamp")
		"broadcasting":
			play("printer")
		"pending", "mined":
			play("flap")
		"released":
			play("bolt")
		"cancelled":
			play("shredder")
		"failed":
			play("buzzer")
