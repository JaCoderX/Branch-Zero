extends RefCounted
class_name BankFonts
## Typography (U7 viz Stage 5) — two OFL faces, both under assets/fonts/ and credited in CREDITS.md:
##   Inter   → the UI face: every Control (HUD, dialogue box, slips, the SubViewport boards) and every Label3D that
##             does not ask for another font (NPC nameplates, the vault clock). Installed once as the engine default.
##   Cinzel  → the plaque face: the brass / graphite plaque *titles* the interior builds with `plaque()` (VAULT,
##             COUNTER 1, NAME DESK…). Body signs (limits poster, payee list, service menu) stay on Inter for legibility.
## Both files are variable fonts; a FontVariation picks the weight so one file serves regular and bold.

const UI_PATH := "res://assets/fonts/Inter.ttf"
const PLAQUE_PATH := "res://assets/fonts/Cinzel.ttf"

static var _cache: Dictionary = {}


static func ui() -> Font:
	return _variation(UI_PATH, 400)


static func ui_bold() -> Font:
	return _variation(UI_PATH, 600)


static func plaque() -> Font:
	return _variation(PLAQUE_PATH, 700)


static func _variation(path: String, wght: int) -> Font:
	var key := "%s@%d" % [path, wght]
	if _cache.has(key):
		return _cache[key]
	if not ResourceLoader.exists(path):
		push_warning("BankFonts: %s missing — the default font stays" % path)
		return null
	var base := load(path) as Font
	if base == null:
		return null
	var v := FontVariation.new()
	v.base_font = base
	v.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): wght}
	_cache[key] = v
	return v


## Make Inter the engine-wide default: the default Theme's `default_font` is what every Control without an override
## and every Label3D without a `font` fall back to (also inside SubViewports, which the window Theme never reaches).
static func install_ui() -> bool:
	var f := ui()
	if f == null:
		return false
	ThemeDB.get_default_theme().default_font = f
	ThemeDB.fallback_font = f
	return true


## Is this plaque a title (first word all caps: VAULT, NAME DESK, COUNTER 1, MANAGER'S OFFICE…) rather than a body sign?
static func is_title(text: String) -> bool:
	var first_line := text.get_slice("\n", 0).strip_edges()
	if first_line == "" or first_line.length() > 40:
		return false
	var word := first_line.get_slice(" ", 0)
	var letters := 0
	for ch in word:
		if (ch >= "a" and ch <= "z") or (ch >= "A" and ch <= "Z"):
			letters += 1
			if ch >= "a" and ch <= "z":
				return false
	return letters > 0


## Put the plaque face on every title plaque under `root` (Label3D with the `template` meta that `plaque()` sets).
## Returns how many got it.
static func dress_plaques(root: Node) -> int:
	var f := plaque()
	if f == null:
		return 0
	var n := 0
	for l in _label3ds(root):
		if l.has_meta("template") and is_title(str(l.get_meta("template"))):
			l.font = f
			n += 1
	return n


static func _label3ds(n: Node) -> Array[Label3D]:
	var out: Array[Label3D] = []
	if n is Label3D:
		out.append(n)
	for c in n.get_children():
		out.append_array(_label3ds(c))
	return out
