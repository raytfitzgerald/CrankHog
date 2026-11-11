// The talking-bobblehead layers for a head Vision can't read as a person: an
// animal, a painting. toon-cutout.swift finds a human face and its lips; here
// you give the head box and the mouth corners by hand, and Vision's
// subject lift (any foreground object, macOS 14+) does the cut-out:
//   <outPrefix>-head.png  the head, with a white sticker outline and a dark mouth
//                         painted where only an open jaw would show it
//   <outPrefix>-jaw.png   the jaw (or lower beak) below the mouth line; it slides
//                         down to talk
// Both layers share one square canvas, chin (or beak tip) at the bottom.
//
// usage: swift scripts/toon-cutout-manual.swift <photo> <outPrefix> <boxX> <boxY> <boxW> <boxH>
//                                               <mouthLX> <mouthLY> <mouthRX> <mouthRY> [jawDepth] [subject|oval]
//   All coordinates are 0..1 of the photo, origin top-left. The box is the head:
//   whatever of the subject lies outside it is dropped. The mouth corners set the
//   line the jaw hinges on; jawDepth (default 0.35, a fraction of the box height)
//   is how far below that line the jaw reaches. `oval` cuts the oval inside the
//   box instead of the subject: for a painting, where nothing stands out from
//   the background.
// The app ships them as WebP (quality 90). Credits: src/renderer/src/coach/toon/heads/ATTRIBUTION.md
import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import Vision

let args = CommandLine.arguments
let v = args.count >= 11 ? args[3...10].compactMap { Double($0) } : []
guard v.count == 8 else {
  fatalError("usage: toon-cutout-manual <in> <outPrefix> <boxX> <boxY> <boxW> <boxH> <mouthLX> <mouthLY> <mouthRX> <mouthRY> [jawDepth]")
}
let jawDepth = args.count >= 12 ? Double(args[11]) ?? 0.35 : 0.35
let oval = args.count >= 13 && args[12] == "oval"
let url = URL(fileURLWithPath: args[1])
let outPrefix = args[2]

guard let src = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) else { fatalError("can't read \(url.path)") }
let ctx = CIContext()
guard let cg = ctx.createCGImage(src, from: src.extent) else { fatalError("no CGImage") }
let W = CGFloat(cg.width), H = CGFloat(cg.height)
// image space: origin bottom-left, in pixels
func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: CGFloat(x) * W, y: (1 - CGFloat(y)) * H) }
let box = CGRect(x: CGFloat(v[0]) * W, y: (1 - CGFloat(v[1] + v[3])) * H, width: CGFloat(v[2]) * W, height: CGFloat(v[3]) * H)
let mL = pt(v[4], v[5]), mR = pt(v[6], v[7])
let fw = box.width, fh = box.height

let cs = CGColorSpaceCreateDeviceGray()
func polygonMask(_ pts: [CGPoint], feather: CGFloat) -> CIImage {
  let g = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.none.rawValue)!
  g.setFillColor(gray: 0, alpha: 1); g.fill(CGRect(x: 0, y: 0, width: W, height: H))
  g.setFillColor(gray: 1, alpha: 1); g.addLines(between: pts); g.closePath(); g.fillPath()
  return CIImage(cgImage: g.makeImage()!).applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: feather]).cropped(to: src.extent)
}
func masked(_ img: CIImage, _ m: CIImage, in r: CGRect) -> CIImage {
  img.cropped(to: r).applyingFilter("CIBlendWithMask", parameters: [
    kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: r), kCIInputMaskImageKey: m])
}

// 1. the subject: Vision's subject lift, or the oval inside the box
func subjectMask() throws -> CIImage {
  if oval {
    let g = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    g.setFillColor(gray: 0, alpha: 1); g.fill(CGRect(x: 0, y: 0, width: W, height: H))
    g.setFillColor(gray: 1, alpha: 1); g.fillEllipse(in: box.insetBy(dx: box.width * 0.02, dy: box.height * 0.02))
    return CIImage(cgImage: g.makeImage()!).applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: max(1.5, box.width * 0.004)]).cropped(to: src.extent)
  }
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  let fgReq = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([fgReq])
  guard let fg = fgReq.results?.first else { fatalError("no subject found") }
  let fgBuf = try fg.generateScaledMaskForImage(forInstances: fg.allInstances, from: handler)
  let m = CIImage(cvPixelBuffer: fgBuf)
  return m.transformed(by: CGAffineTransform(scaleX: W / m.extent.width, y: H / m.extent.height))
}
let subject = try subjectMask()

// 2. the head: the subject inside the box, a pixel eroded so no background halo survives
let boxMask = polygonMask([box.origin, CGPoint(x: box.maxX, y: box.minY), CGPoint(x: box.maxX, y: box.maxY), CGPoint(x: box.minX, y: box.maxY)], feather: max(1.5, fw * 0.01))
let alpha = subject.applyingFilter("CIMultiplyCompositing", parameters: [kCIInputBackgroundImageKey: boxMask])
  .applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: max(1, fw * 0.006)])
  .cropped(to: box)

// 3. the sticker: the head plus a white outline (its alpha, dilated)
let vivid = src.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 1.08, kCIInputContrastKey: 1.05])
let r = max(4, box.width * 0.03)
let stickerRect = box.insetBy(dx: -r * 2, dy: -r * 2)
let grown = alpha.applyingFilter("CIMorphologyMaximum", parameters: [kCIInputRadiusKey: r])
  .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 1.2]).cropped(to: stickerRect)
let outline = masked(CIImage(color: .white), grown, in: stickerRect)
let sticker = masked(vivid, alpha, in: box).composited(over: outline)

// 4. the jaw: below the mouth line, between lines dropping from the corners
let deep = fh * CGFloat(jawDepth)
let spreadOut = (mR.x - mL.x) * 0.35
let jawPoly = [CGPoint(x: mL.x - spreadOut, y: mL.y - deep), mL, mR, CGPoint(x: mR.x + spreadOut, y: mR.y - deep)]
let jawPiece = masked(sticker, polygonMask(jawPoly, feather: max(0.8, fw * 0.004)), in: stickerRect)
// behind it, a dark mouth that only shows when the jaw drops
// no deeper than the jaw, or a thin one (a beak) shows it at rest
let mouthW = (mR.x - mL.x) * 0.5, mouthH = min(fh * 0.12, deep * 0.7)
let disc = CIFilter.radialGradient()
disc.center = .zero; disc.radius0 = 0.9; disc.radius1 = 1.0
disc.color0 = CIColor(red: 0.27, green: 0.08, blue: 0.09); disc.color1 = CIColor(red: 0.27, green: 0.08, blue: 0.09, alpha: 0)
let unit = CGRect(x: -1, y: -1, width: 2, height: 2)
let lowerHalf = CIImage(color: .white).cropped(to: CGRect(x: -2, y: -2, width: 4, height: 2)) // y ≤ 0
let mouth = disc.outputImage!.cropped(to: unit)
  .applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: unit), kCIInputMaskImageKey: lowerHalf])
  .transformed(by: CGAffineTransform(scaleX: mouthW, y: mouthH).concatenating(CGAffineTransform(translationX: (mL.x + mR.x) / 2, y: (mL.y + mR.y) / 2)))
let baseLayer = mouth.composited(over: sticker).cropped(to: stickerRect)

// 5. both layers on one square canvas, the bottom of the head centred at the bottom
func alphaBounds(_ img: CIImage) -> CGRect {
  let e = img.extent.integral
  let w = Int(e.width), h = Int(e.height)
  var px = [UInt8](repeating: 0, count: w * h * 4)
  ctx.render(img, toBitmap: &px, rowBytes: w * 4, bounds: e, format: .RGBA8, colorSpace: nil)
  var minX = w, maxX = -1, minY = h, maxY = -1
  for y in 0..<h { for x in 0..<w where px[(y * w + x) * 4 + 3] > 10 {
    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
  }}
  // bitmap rows run top-down
  return CGRect(x: e.minX + CGFloat(minX), y: e.maxY - CGFloat(maxY + 1), width: CGFloat(maxX - minX + 1), height: CGFloat(maxY - minY + 1))
}
let S: CGFloat = 288, margin: CGFloat = 4
let bb = alphaBounds(sticker)
// centred on the head itself: a goose's neck should stand under it, not under the beak
let anchorX = bb.midX
let scale = min((S - margin * 2) * 0.99 / bb.height, (S / 2 - margin) / max(anchorX - bb.minX, bb.maxX - anchorX))
let place = CGAffineTransform(translationX: -anchorX, y: -bb.minY).concatenating(CGAffineTransform(scaleX: scale, y: scale))
  .concatenating(CGAffineTransform(translationX: S / 2, y: margin))
let canvas = CGRect(x: 0, y: 0, width: S, height: S)
func onCanvas(_ img: CIImage) -> CIImage { img.transformed(by: place).composited(over: CIImage(color: .clear).cropped(to: canvas)).cropped(to: canvas) }
func write(_ img: CIImage, _ name: String) {
  let path = "\(outPrefix)-\(name).png"
  try! ctx.writePNGRepresentation(of: onCanvas(img), to: URL(fileURLWithPath: path), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
  print("wrote", path)
}
write(baseLayer, "head")
write(jawPiece, "jaw")
