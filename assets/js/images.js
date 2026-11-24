// Shrinks a photo in the browser before upload so pages stay readable but small.
// The storage bucket accepts files up to 2 MB (see supabase/schema.sql).

const STEPS = [[1600, 0.78], [1400, 0.7], [1200, 0.62], [1000, 0.54], [800, 0.46]];
const GOOD_ENOUGH = 900_000;   // stop shrinking once under about 0.9 MB
const HARD_LIMIT = 1_900_000;  // refuse anything still above this

const toBlob = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.onload = async () => {
      URL.revokeObjectURL(url);
      let best = null;
      for (const [longSide, quality] of STEPS) {
        const scale = Math.min(1, longSide / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const blob = await toBlob(canvas, quality);
        if (!blob) continue;
        best = { blob, width, height };
        if (blob.size <= GOOD_ENOUGH) break;
      }
      if (!best || best.blob.size > HARD_LIMIT) reject(new Error('too big'));
      else resolve(best);
    };
    img.src = url;
  });
}
