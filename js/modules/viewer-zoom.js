// Pointer-driven zoom / pan / swipe for the viewer. No library.
//
// The media element is laid out "fit" (object-fit: contain inside the stage);
// zoom is a CSS transform on it: translate(tx, ty) scale(s) around its centre,
// where s = 1 is the fitted size. Wheel / pinch / double-tap zoom around the
// pointer, drag pans when zoomed, and a horizontal flick at s = 1 is a swipe.

const SWIPE_MIN_DISTANCE = 60;
const SWIPE_MIN_VELOCITY = 0.5; // px per ms
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 8;
const WHEEL_STEP = 0.0015;

export function createZoom({ stage, target, getImageSize, onSwipe, onTap, onZoomChange }) {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let enabled = true;

  const pointers = new Map(); // id -> {x, y}
  let gesture = null; // {type: 'pan'|'pinch'|'swipe', ...}
  let lastTap = { time: 0, x: 0, y: 0 };

  function stageBox() {
    return stage.getBoundingClientRect();
  }

  // Fitted (scale = 1) size of the image inside the stage, in CSS px.
  function fitted() {
    const size = getImageSize();
    const box = stageBox();
    if (!size || !size.w || !size.h) return { w: box.width, h: box.height, box };
    const ratio = Math.min(box.width / size.w, box.height / size.h);
    return { w: size.w * ratio, h: size.h * ratio, box };
  }

  // Zoom level at which one image pixel is one CSS pixel.
  function actualPixelScale() {
    const size = getImageSize();
    const { w } = fitted();
    return size && size.w && w ? size.w / w : 1;
  }

  function maxScale() {
    return Math.max(actualPixelScale(), 2.5);
  }

  function clampPan() {
    const { w, h, box } = fitted();
    const maxX = Math.max(0, (w * scale - box.width) / 2);
    const maxY = Math.max(0, (h * scale - box.height) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function apply() {
    clampPan();
    target.style.transform = scale === 1 && tx === 0 && ty === 0
      ? ''
      : `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function setScale(next, cx, cy) {
    const prevZoomed = scale > 1.001;
    const clamped = Math.min(maxScale(), Math.max(1, next));
    const box = stageBox();
    // Pointer relative to the stage centre; keep that image point fixed.
    const px = cx - (box.left + box.width / 2);
    const py = cy - (box.top + box.height / 2);
    const ratio = clamped / scale;
    tx = px - (px - tx) * ratio;
    ty = py - (py - ty) * ratio;
    scale = clamped;
    if (scale <= 1.001) {
      scale = 1;
      tx = 0;
      ty = 0;
    }
    apply();
    const zoomed = scale > 1.001;
    if (zoomed !== prevZoomed && onZoomChange) onZoomChange(zoomed);
  }

  function centre() {
    const box = stageBox();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  function toggle(cx, cy) {
    if (!enabled) return;
    if (scale > 1.001) {
      setScale(1, cx, cy);
    } else {
      const actual = actualPixelScale();
      setScale(actual > 1.2 ? Math.min(actual, maxScale()) : 2, cx, cy);
    }
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, a, input, iframe')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { stage.setPointerCapture(e.pointerId); } catch { /* not capturable */ }

    if (pointers.size === 2 && enabled) {
      const [a, b] = [...pointers.values()];
      gesture = { type: 'pinch', startDist: distance(a, b) || 1, startScale: scale };
    } else if (pointers.size === 1) {
      gesture = {
        type: scale > 1.001 ? 'pan' : 'swipe',
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        startTime: e.timeStamp,
        moved: false,
      };
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture.type === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setScale(gesture.startScale * (distance(a, b) / gesture.startDist), mid.x, mid.y);
      return;
    }

    if (gesture.type === 'pan' || gesture.type === 'swipe') {
      const dx = e.clientX - gesture.lastX;
      const dy = e.clientY - gesture.lastY;
      gesture.lastX = e.clientX;
      gesture.lastY = e.clientY;
      if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > TAP_SLOP) {
        gesture.moved = true;
      }
      if (gesture.type === 'pan') {
        tx += dx;
        ty += dy;
        apply();
      }
    }
  }

  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const g = gesture;

    if (pointers.size > 0) {
      // One finger left after a pinch: continue as a pan from here.
      const [p] = [...pointers.values()];
      gesture = {
        type: scale > 1.001 ? 'pan' : 'swipe-ignored',
        startX: p.x, startY: p.y, lastX: p.x, lastY: p.y,
        startTime: e.timeStamp, moved: true,
      };
      return;
    }
    gesture = null;
    if (!g || g.type === 'pinch' || g.type === 'swipe-ignored') return;

    if (!g.moved) {
      // Tap / click. Two close together is a double tap.
      const closeInTime = e.timeStamp - lastTap.time < DOUBLE_TAP_MS;
      const closeInSpace = Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
      if (closeInTime && closeInSpace) {
        lastTap = { time: 0, x: 0, y: 0 };
        toggle(e.clientX, e.clientY);
      } else {
        lastTap = { time: e.timeStamp, x: e.clientX, y: e.clientY };
        if (onTap) onTap();
      }
      return;
    }

    if (g.type === 'swipe' && scale <= 1.001) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const dt = Math.max(1, e.timeStamp - g.startTime);
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
      if (horizontal && (Math.abs(dx) >= SWIPE_MIN_DISTANCE || Math.abs(dx) / dt >= SWIPE_MIN_VELOCITY)) {
        if (onSwipe) onSwipe(dx < 0 ? 1 : -1);
      }
    }
  }

  function onPointerCancel(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) gesture = null;
  }

  function onWheel(e) {
    if (!enabled) return;
    e.preventDefault();
    // ctrl+wheel (trackpad pinch) arrives with small deltas; plain wheel steps.
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    setScale(scale * Math.exp(-delta * WHEEL_STEP * (e.ctrlKey ? 3 : 1)), e.clientX, e.clientY);
  }

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerCancel);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.style.touchAction = 'none';

  return {
    reset() {
      const was = scale > 1.001;
      scale = 1;
      tx = 0;
      ty = 0;
      apply();
      if (was && onZoomChange) onZoomChange(false);
    },
    isZoomed: () => scale > 1.001,
    setEnabled(value) {
      enabled = value;
      if (!value) this.reset();
    },
    toggle(cx, cy) {
      const c = centre();
      toggle(cx ?? c.x, cy ?? c.y);
    },
    zoomBy(factor) {
      if (!enabled) return;
      const c = centre();
      setScale(scale * factor, c.x, c.y);
    },
    // Keyboard panning while zoomed.
    panBy(dx, dy) {
      if (scale <= 1.001) return false;
      tx += dx;
      ty += dy;
      apply();
      return true;
    },
    refresh: apply,
  };
}
