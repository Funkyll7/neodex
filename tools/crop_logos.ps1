# crop_logos.ps1 — recadre les logos de assets/img/sources/ vers assets/img/.
#
# Les logos officiels arrivent centres dans une grande zone blanche. Il faut
# donc les detourer, mais un simple « blanc -> transparent » perforerait le
# dessin : la flamme de Paldea et la Poke Ball de Galar SONT blanches.
#
# La solution est un remplissage depuis les bords : seul le blanc relie au
# bord de l'image devient transparent, le blanc enferme dans le dessin reste
# opaque. On calcule ensuite la boite englobante et on redimensionne.
#
# En PowerShell et non en Python, contrairement au reste de tools/ : ce script
# n'a besoin que de System.Drawing, deja present sur Windows.
#
# Usage :  powershell -ExecutionPolicy Bypass -File tools/crop_logos.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Crop
{
    // Le blanc EXTERIEUR seulement : on remplit depuis les bords.
    // Le blanc interieur (flamme de Paldea, Poke Ball de Galar) reste opaque.
    public static string Run(string src, string dst, int size, int seuil)
    {
        using (Bitmap orig = new Bitmap(src))
        {
            int W = orig.Width, H = orig.Height;
            Bitmap bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
            using (Graphics g0 = Graphics.FromImage(bmp)) { g0.DrawImage(orig, 0, 0, W, H); }

            BitmapData bd = bmp.LockBits(new Rectangle(0, 0, W, H),
                ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = bd.Stride;
            byte[] px = new byte[stride * H];
            System.Runtime.InteropServices.Marshal.Copy(bd.Scan0, px, 0, px.Length);

            bool[] vu = new bool[W * H];
            Stack<int> pile = new Stack<int>();
            for (int x = 0; x < W; x++) { pile.Push(x); pile.Push((H - 1) * W + x); }
            for (int y = 0; y < H; y++) { pile.Push(y * W); pile.Push(y * W + W - 1); }

            while (pile.Count > 0)
            {
                int k = pile.Pop();
                if (k < 0 || k >= W * H || vu[k]) continue;
                int x = k % W, y = k / W;
                int i = y * stride + x * 4;           // BGRA
                if (px[i + 3] < 8) { vu[k] = true; continue; }
                if (!(px[i] >= seuil && px[i + 1] >= seuil && px[i + 2] >= seuil)) continue;
                vu[k] = true;
                px[i + 3] = 0;
                if (x > 0) pile.Push(k - 1);
                if (x < W - 1) pile.Push(k + 1);
                if (y > 0) pile.Push(k - W);
                if (y < H - 1) pile.Push(k + W);
            }

            int x0 = W, y0 = H, x1 = -1, y1 = -1;
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                    if (px[y * stride + x * 4 + 3] > 8)
                    {
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }

            System.Runtime.InteropServices.Marshal.Copy(px, 0, bd.Scan0, px.Length);
            bmp.UnlockBits(bd);

            int cw = x1 - x0 + 1, ch = y1 - y0 + 1;
            int cote = Math.Max(cw, ch);

            Bitmap outBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(outBmp))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;
                int marge = (int)Math.Round(size * 0.03);
                float dispo = size - 2 * marge;
                float ech = dispo / cote;
                float dw = cw * ech, dh = ch * ech;
                g.DrawImage(bmp,
                    new RectangleF(marge + (dispo - dw) / 2f, marge + (dispo - dh) / 2f, dw, dh),
                    new RectangleF(x0, y0, cw, ch), GraphicsUnit.Pixel);
            }
            outBmp.Save(dst, ImageFormat.Png);
            outBmp.Dispose();
            bmp.Dispose();
            return string.Format("{0}x{1} -> contenu {2}x{3} -> {4}x{4}", W, H, cw, ch, size);
        }
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$racine = Split-Path -Parent $PSScriptRoot
$img = Join-Path $racine "assets/img"
$src = Join-Path $img "sources"
$jobs = @(
  @{ src = "shiny.jpg";       dst = "shiny.png";        size = 64 },
  @{ src = "forme-alola.png";  dst = "forme-alola.png";  size = 96 },
  @{ src = "forme-galar.png";  dst = "forme-galar.png";  size = 96 },
  @{ src = "forme-paldea.png"; dst = "forme-paldea.png"; size = 96 }
)

foreach ($j in $jobs) {
  $s = Join-Path $src $j.src
  $d = Join-Path $img $j.dst
  $info = [Crop]::Run($s, $d, $j.size, 238)
  $ko = [math]::Round((Get-Item $d).Length / 1KB, 1)
  "$($j.dst.PadRight(20)) $info  ($ko Ko)"
}
