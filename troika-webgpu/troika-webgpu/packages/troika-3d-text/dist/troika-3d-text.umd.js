(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('troika-three-text'), require('troika-3d'), require('three'), require('troika-three-utils')) :
  typeof define === 'function' && define.amd ? define(['exports', 'troika-three-text', 'troika-3d', 'three', 'troika-three-utils'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.troika_3d_text = {}, global.troika_three_text, global.troika_3d, global.THREE, global.troika_three_utils));
}(this, (function (exports, troikaThreeText, troika3d, three, troikaThreeUtils) { 'use strict';

  const tempVec4 = new three.Vector4();

  let getMeshes = function() {
    let material = troika3d.createDerivedMaterial(
      new three.MeshBasicMaterial({
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      }),
      {
        uniforms: {
          rect: {value: new three.Vector4()},
          depthAndCurveRadius: {value: new three.Vector2()}
        },
        vertexDefs: `
uniform vec4 rect;
uniform vec2 depthAndCurveRadius;
`,
        vertexTransform: `
float depth = depthAndCurveRadius.x;
float rad = depthAndCurveRadius.y;
position.x = mix(rect.x, rect.z, position.x);
position.y = mix(rect.w, rect.y, position.y);
position.z = mix(-depth * 0.5, depth * 0.5, position.z);
if (rad != 0.0) {
  float angle = position.x / rad;
  position.xz = vec2(sin(angle) * (rad - position.z), rad - cos(angle) * (rad - position.z));
  // TODO fix normals: normal.xz = vec2(sin(angle), cos(angle));
}
`
      }
    );
    const meshes = {
      normal: new three.Mesh(
        new three.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5),
        material
      ),
      curved: new three.Mesh(
        new three.BoxGeometry(1, 1, 1, 32).translate(0.5, 0.5, 0.5),
        material
      )
    };
    return (getMeshes = () => meshes)()
  };


  // TODO make instanceable or a single updated geometry to limit to a single draw call

  class RangeRectFacade extends troika3d.Instanceable3DFacade {
    constructor (parent) {
      super(parent);
      this.depth = 0;
      this.curveRadius = 0;
      this._color = new three.Color();
      this._rect = new three.Vector4();
    }

    afterUpdate() {
      const {top, right, bottom, left, color, depth, curveRadius} = this;
      this.instancedThreeObject = getMeshes()[curveRadius ? 'curved' : 'normal'];

      if (!this._color.equals(color)) {
        this.setInstanceUniform('diffuse', this._color = new three.Color(color));
      }

      if (!this._rect.equals(tempVec4.set(left, top, right, bottom))) {
        this.setInstanceUniform('rect', tempVec4.clone());
      }
      if (!depth !== this._depth || curveRadius !== this._curveRadius) {
        this.setInstanceUniform('depthAndCurveRadius', new three.Vector2(this._depth = depth, this._curveRadius = curveRadius));
      }
      super.afterUpdate();
    }

    getBoundingSphere () {
      return null
    }
  }

  const THICKNESS = 0.25; //rect depth as percentage of height

  const tempMat4 = new three.Matrix4();
  const tempPlane = new three.Plane();
  const tempVec2 = new three.Vector2();
  const tempVec3 = new three.Vector3();
  const noClip = Object.freeze([-Infinity, -Infinity, Infinity, Infinity]);

  /**
   * Manager facade for selection rects and user selection behavior
   */
  class SelectionManagerFacade extends troika3d.ListFacade {
    constructor (parent, onSelectionChange) {
      super(parent);
      const textMesh = parent.threeObject;

      this.rangeColor = 0x00ccff;
      this.clipRect = noClip;
      this.curveRadius = 0;

      this.template = {
        key: (d, i) => `rect${i}`,
        facade: RangeRectFacade,
        top: d => clamp(d.top, this.clipRect[1], this.clipRect[3]),
        right: d => clamp(d.right, this.clipRect[0], this.clipRect[2]),
        bottom: d => clamp(d.bottom, this.clipRect[1], this.clipRect[3]),
        left: d => clamp(d.left, this.clipRect[0], this.clipRect[2]),
        depth: d => (d.top - d.bottom) * THICKNESS,
        color: d => this.rangeColor,
        curveRadius: d => this.curveRadius,
        visible: d => {
          let r = this.clipRect;
          return d.right > r[0] && d.top > r[1] && d.left < r[2] && d.bottom < r[3]
        },
        renderOrder: d => this.renderOrder || 0
      };

      const onDragStart = e => {
        const textRenderInfo = textMesh.textRenderInfo;
        if (textRenderInfo) {
          const textPos = textMesh.worldPositionToTextCoords(e.intersection.point, tempVec2);
          const caret = troikaThreeText.getCaretAtPoint(textRenderInfo, textPos.x, textPos.y);
          if (caret) {
            onSelectionChange(caret.charIndex, caret.charIndex);
            parent.addEventListener('drag', onDrag);
            parent.addEventListener('dragend', onDragEnd);
          }
          e.preventDefault();
        }
      };

      const onDrag = e => {
        const textRenderInfo = textMesh.textRenderInfo;
        if (e.ray && textRenderInfo) {
          // If it's hitting on the Text mesh, do an exact translation; otherwise raycast to an
          // infinite plane so dragging outside the text bounds will work
          let textPos;
          const ix = e.intersection;
          if (ix && ix.object === textMesh && ix.point) {
            textPos = textMesh.worldPositionToTextCoords(ix.point, tempVec2);
          } else {
            const ray = e.ray.clone().applyMatrix4(troikaThreeUtils.invertMatrix4(textMesh.matrixWorld, tempMat4));
            textPos = ray.intersectPlane(tempPlane.setComponents(0, 0, 1, 0), tempVec3);
          }
          if (textPos) {
            const caret = troikaThreeText.getCaretAtPoint(textRenderInfo, textPos.x, textPos.y);
            if (caret) {
              onSelectionChange(this.selectionStart, caret.charIndex);
            }
          }
          e.preventDefault();
        }
      };

      const onDragEnd = e => {
        parent.removeEventListener('drag', onDrag);
        parent.removeEventListener('dragend', onDragEnd);
      };

      parent.addEventListener('dragstart', onDragStart);
      parent.addEventListener('mousedown', onDragStart);

      this._cleanupEvents = () => {
        onDragEnd();
        parent.removeEventListener('dragstart', onDragStart);
        parent.removeEventListener('mousedown', onDragStart);
      };
    }

    afterUpdate() {
      this.data = troikaThreeText.getSelectionRects(this.textRenderInfo, this.selectionStart, this.selectionEnd);
      super.afterUpdate();
    }

    // normalize clipRect
    set clipRect(clipRect) {
      this._clipRect = (clipRect && Array.isArray(clipRect) && clipRect.length === 4) ? clipRect : noClip;
    }
    get clipRect() {
      return this._clipRect
    }

    destructor () {
      this._cleanupEvents();
      super.destructor();
    }
  }

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val))
  }

  // Properties that will simply be forwarded to the TextMesh:
  const TEXT_MESH_PROPS = [
    'text',
    'anchorX',
    'anchorY',
    'font',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'lineHeight',
    'maxWidth',
    'overflowWrap',
    'direction',
    'textAlign',
    'textIndent',
    'whiteSpace',
    'material',
    'color',
    'colorRanges',
    'fillOpacity',
    'outlineOpacity',
    'outlineColor',
    'outlineWidth',
    'outlineOffsetX',
    'outlineOffsetY',
    'outlineBlur',
    'strokeColor',
    'strokeWidth',
    'strokeOpacity',
    'curveRadius',
    'depthOffset',
    'clipRect',
    'orientation',
    'glyphGeometryDetail',
    'sdfGlyphSize',
    'unicodeFontsURL',
    'gpuAccelerateSDF',
    'debugSDF'
  ];


  /**
   * Facade wrapper for a TextMesh. All configuration properties of TextMesh
   * are accepted and proxied through directly.
   */
  class Text3DFacade extends troika3d.Object3DFacade {
    constructor(parent) {
      const mesh = new troikaThreeText.Text();
      mesh.geometry.boundingSphere.version = 0;
      super(parent, mesh);

      /* TODO mirroring to DOM...?
      const el = this._domEl = document.createElement('section')
      el.style = 'position:fixed;left:-99px;overflow:hidden;width:10px;height:10px;'
      document.body.appendChild(el) //should insert into local element
      */

      this.selectable = false;
      this.selectionStart = this.selectionEnd = -1;
      this.onSyncStart = null;
      this.onSyncComplete = null;
      this.gpuAccelerateSDF = true;

      mesh.addEventListener('syncstart', e => {
        this.notifyWorld('text3DSyncStart');
        if (this.onSyncStart) {
          this.onSyncStart();
        }
      });
      mesh.addEventListener('synccomplete', e => {
        if (!this.isDestroying) {
          mesh.geometry.boundingSphere.version++;
          this.afterUpdate();
          this.notifyWorld('text3DSyncComplete');
          this.requestRender();
          if (this.onSyncComplete) {
            this.onSyncComplete();
          }
        }
      });
    }

    get textRenderInfo() {
      return this.threeObject.textRenderInfo
    }

    afterUpdate() {
      const textMesh = this.threeObject;
      TEXT_MESH_PROPS.forEach(prop => {
        textMesh[prop] = this[prop];
      });
      textMesh.sync();

      super.afterUpdate();

      if (this.text !== this._prevText) {
        // TODO mirror to DOM... this._domEl.textContent = this.text
        // Clear selection when text changes
        this.selectionStart = this.selectionEnd = -1;
        this._prevText = this.text;
      }

      this._updateSelection();
    }

    _updateSelection() {
      const {selectable, selectionStart, selectionEnd} = this;
      let selFacade = this._selectionFacade;
      if (selectable !== this._selectable) {
        this._selectable = selectable;
        if (selectable) {
          selFacade = this._selectionFacade = new SelectionManagerFacade(this, (start, end) => {
            this.selectionStart = start;
            this.selectionEnd = end;
            this._updateSelection();
            this.requestRender();
          });
        } else {
          if (selFacade) {
            selFacade.destructor();
            selFacade = this._selectionFacade = null;
          }
          this.selectionStart = this.selectionEnd = -1;
        }
      }
      if (selFacade) {
        selFacade.textRenderInfo = this.threeObject.textRenderInfo;
        selFacade.selectionStart = selectionStart;
        selFacade.selectionEnd = selectionEnd;
        selFacade.curveRadius = this.curveRadius || 0;
        selFacade.clipRect = this.clipRect;
        selFacade.renderOrder = this.renderOrder;
        selFacade.afterUpdate();
      }

      /* TODO update selection in DOM...
      const {selectionStart, selectionEnd} = this
      if (selectionStart !== this._prevSelStart || selectionEnd !== this._prevSelEnd) {
        this._prevSelStart = selectionStart
        this._prevSelEnd = selectionEnd
        const sel = document.getSelection()
        sel.removeAllRanges()
        if (this.selectable && selectionStart > -1 && selectionEnd > selectionStart) {
          const range = document.createRange()
          range.setStart(this._domEl.firstChild, this.selectionStart)
          range.setEnd(this._domEl.firstChild, this.selectionEnd)
          sel.addRange(range)
        }
      }
      */
    }

    destructor() {
      this.threeObject.dispose();
      //this._domEl.parentNode.removeChild(this._domEl)
      if (this._selectionFacade) {
        this._selectionFacade.destructor();
      }
      super.destructor();
    }
  }

  class BatchedText3DFacade extends troika3d.Object3DFacade {
    constructor(parent) {
      super(parent, new troikaThreeText.BatchedText());

      // Non-renderable container for children so they don't end up in the scene
      this._texts = new troika3d.Object3DFacade(this);
      this._texts.visible = false;
    }

    afterUpdate() {
      TEXT_MESH_PROPS.forEach(prop => {
        this.threeObject[prop] = this[prop];
      });
      this._texts.children = this.children;
      const prevTexts = new Set(this._texts.threeObject.children);
      this._texts.afterUpdate();
      this._texts.threeObject.children.forEach(text => {
        this.threeObject.addText(text);
        prevTexts.delete(text);
      });
      prevTexts.forEach(text => this.threeObject.removeText(text));
      super.afterUpdate();
    }

    shouldUpdateChildren() {
      return false
    }
  }

  Object.defineProperty(exports, 'GlyphsGeometry', {
    enumerable: true,
    get: function () {
      return troikaThreeText.GlyphsGeometry;
    }
  });
  Object.defineProperty(exports, 'TextMesh', {
    enumerable: true,
    get: function () {
      return troikaThreeText.Text;
    }
  });
  Object.defineProperty(exports, 'configureTextBuilder', {
    enumerable: true,
    get: function () {
      return troikaThreeText.configureTextBuilder;
    }
  });
  Object.defineProperty(exports, 'dumpSDFTextures', {
    enumerable: true,
    get: function () {
      return troikaThreeText.dumpSDFTextures;
    }
  });
  Object.defineProperty(exports, 'getCaretAtPoint', {
    enumerable: true,
    get: function () {
      return troikaThreeText.getCaretAtPoint;
    }
  });
  Object.defineProperty(exports, 'getSelectionRects', {
    enumerable: true,
    get: function () {
      return troikaThreeText.getSelectionRects;
    }
  });
  Object.defineProperty(exports, 'preloadFont', {
    enumerable: true,
    get: function () {
      return troikaThreeText.preloadFont;
    }
  });
  Object.defineProperty(exports, 'typesetterWorkerModule', {
    enumerable: true,
    get: function () {
      return troikaThreeText.typesetterWorkerModule;
    }
  });
  exports.BatchedText3DFacade = BatchedText3DFacade;
  exports.Text3DFacade = Text3DFacade;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
