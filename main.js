let container, camera, scene, renderer, options, controls, trfm_ctrl;
let subLevel = 0;
let smooth_mesh, ori_geom;
let smooth_verts_undeformed = [];
let model_index = 0;
let model_scale;

let BBox = new THREE.Box3();

let ctrlPtCounts = [0, 0, 0];
let totalCtrlPtCount = 0;
let controlPoints = [];

getControlPointIndex = function (i, j, k) {
	return i * ctrlPtCounts[1] * ctrlPtCounts[2] + j * ctrlPtCounts[2] + k;
};
//阶乘的实现
function fac(n) {
	return n > 1 ? n * fac(n - 1) : 1
}

function bernstein(n, k, u) {
	return Math.pow(1 - u, n - k) * Math.pow(u, k) * fac(n) / (fac(k) * fac(n - k));
};

function FFD() {
	let mSpanCounts = [0, 0, 0];
	
	this.rebuildLattice = function (bbox, span_counts) {

		if (BBox.equals(bbox) &&
			mSpanCounts[0] == span_counts[0] &&
			mSpanCounts[1] == span_counts[1] &&
			mSpanCounts[2] == span_counts[2])
			return;

		BBox = bbox;
		mSpanCounts = span_counts;
		ctrlPtCounts = [mSpanCounts[0] + 1, mSpanCounts[1] + 1, mSpanCounts[2] + 1];
		totalCtrlPtCount = ctrlPtCounts[0] * ctrlPtCounts[1] * ctrlPtCounts[2];

		RPosition[0].x = BBox.max.x - BBox.min.x;
		RPosition[1].y = BBox.max.y - BBox.min.y;
		RPosition[2].z = BBox.max.z - BBox.min.z;


		controlPoints = new Array(totalCtrlPtCount);


		for (let i = 0; i < ctrlPtCounts[0]; i++) {
			for (let j = 0; j < ctrlPtCounts[1]; j++) {
				for (let k = 0; k < ctrlPtCounts[2]; k++) {
					let position = new THREE.Vector3(
						BBox.min.x + (i / mSpanCounts[0]) * RPosition[0].x,
						BBox.min.y + (j / mSpanCounts[1]) * RPosition[1].y,
						BBox.min.z + (k / mSpanCounts[2]) * RPosition[2].z
					);
					this.setPositionTernary(i, j, k, position);
				}
			}
		}
	};

	this.evalTrivariate = function (s, t, u) {
		let eval_pt = new THREE.Vector3(0, 0, 0);
		for (let i = 0; i < ctrlPtCounts[0]; i++) {
			let point1 = new THREE.Vector3(0, 0, 0);
			for (let j = 0; j < ctrlPtCounts[1]; j++) {
				let point2 = new THREE.Vector3(0, 0, 0);
				for (let k = 0; k < ctrlPtCounts[2]; k++) {
					let position = controlPoints[getControlPointIndex(i, j, k)];
					let poly_u = bernstein(mSpanCounts[2], k, u);
					point2.addScaledVector(position, poly_u);
				}
				let poly_t = bernstein(mSpanCounts[1], j, t);
				point1.addScaledVector(point2, poly_t);
			}
			let poly_s = bernstein(mSpanCounts[0], i, s);
			eval_pt.addScaledVector(point1, poly_s);
		}
		return eval_pt;
	};

	this.updateLines = function (latticeLines) {
		for (let i = 0; i < totalCtrlPtCount; i++)
			ffd.setPosition(i, ctrl_pt_meshes[i].position);
		let line_index = 0;
		for (let i = 0; i < ctrlPtCounts[0] - 1; i++) {
			for (let j = 0; j < ctrlPtCounts[1]; j++) {
				for (let k = 0; k < ctrlPtCounts[2]; k++) {
					let line = latticeLines[line_index++];
					line.geometry.vertices[0] = ctrl_pt_meshes[getControlPointIndex(i, j, k)].position;
					line.geometry.vertices[1] = ctrl_pt_meshes[getControlPointIndex(i + 1, j, k)].position;
					line.geometry.verticesNeedUpdate = true;
				}
			}
		}
		for (let i = 0; i < ctrlPtCounts[0]; i++) {
			for (let j = 0; j < ctrlPtCounts[1] - 1; j++) {
				for (let k = 0; k < ctrlPtCounts[2]; k++) {
					let line = latticeLines[line_index++];
					line.geometry.vertices[0] = ctrl_pt_meshes[getControlPointIndex(i, j, k)].position;
					line.geometry.vertices[1] = ctrl_pt_meshes[getControlPointIndex(i, j + 1, k)].position;
					line.geometry.verticesNeedUpdate = true;
				}
			}
		}
		for (let i = 0; i < ctrlPtCounts[0]; i++) {
			for (let j = 0; j < ctrlPtCounts[1]; j++) {
				for (let k = 0; k < ctrlPtCounts[2] - 1; k++) {
					let line = latticeLines[line_index++];
					line.geometry.vertices[0] = ctrl_pt_meshes[getControlPointIndex(i, j, k)].position;
					line.geometry.vertices[1] = ctrl_pt_meshes[getControlPointIndex(i, j, k + 1)].position;
					line.geometry.verticesNeedUpdate = true;
				}
			}
		}
	}
	this.convertToParam = function (world_pt) {

		let worldmin = new THREE.Vector3(world_pt.x, world_pt.y, world_pt.z);
		worldmin.sub(BBox.min);

		let cross = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
		cross[0].crossVectors(RPosition[1], RPosition[2]);
		cross[1].crossVectors(RPosition[0], RPosition[2]);
		cross[2].crossVectors(RPosition[0], RPosition[1]);

		let param = new THREE.Vector3();
		for (let i = 0; i < 3; i++) {
			let numer = cross[i].dot(worldmin);
			let denom = cross[i].dot(RPosition[i]);
			param.setComponent(i, numer / denom);
		}
		return param;
	};

	this.setPosition = function (index, position) {
		controlPoints[index] = position;
	};
	this.setPositionTernary = function (i, j, k, position) {
		controlPoints[getControlPointIndex(i, j, k)] = position;
	};


	let RPosition = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];




}
FFD.prototype.eval = function (worldPoint) {
	let param = this.convertToParam(worldPoint);
	return this.evalTrivariate(param.x, param.y, param.z);
}

let ffd = new FFD();
let span_counts = [1, 1, 1];
let ctrlPointGeometry = new THREE.SphereGeometry(5);
let ctrlPointMaterial = new THREE.MeshLambertMaterial({ color: 0xf00ff0 });
let ctrl_pt_meshes = [];
let ctrl_pt_mesh_selected = null;
let latticeLines = [];
let latticeLinesMaterial = new THREE.LineBasicMaterial({ color: 0x4d4dff });
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

const length = 120, width = 80;

const shape = new THREE.Shape();
shape.moveTo( 0,0 );
shape.lineTo( 0, width );
shape.lineTo( length, width );
shape.lineTo( length, 0 );
shape.lineTo( 0, 0 );
const extrudeSettings = {
	steps: 2,
	depth: 16,
	bevelEnabled: true,
	bevelThickness: 1,
	bevelSize: 1,
	bevelOffset: 0,
	bevelSegments: 1
};
const x = 0, y = 0;

const heartShape = new THREE.Shape();

heartShape.moveTo( x + 5, y + 5 );
heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );
class CustomSinCurve extends THREE.Curve {

	constructor( scale = 1 ) {

		super();

		this.scale = scale;

	}

	getPoint( t, optionalTarget = new THREE.Vector3() ) {

		const tx = t * 3 - 1.5;
		const ty = Math.sin( 2 * Math.PI * t );
		const tz = 0;

		return optionalTarget.set( tx, ty, tz ).multiplyScalar( this.scale );

	}

}

const path = new CustomSinCurve( 10 );
const verticesOfCube = [
    -1,-1,-1,    1,-1,-1,    1, 1,-1,    -1, 1,-1,
    -1,-1, 1,    1,-1, 1,    1, 1, 1,    -1, 1, 1,
];

const indicesOfFaces = [
    2,1,0,    0,3,2,
    0,4,7,    7,3,0,
    0,1,5,    5,4,0,
    1,2,6,    6,5,1,
    2,3,7,    7,6,2,
    4,5,6,    6,7,4
];
let models = [
	{ type: 'BoxGeometry', args: [200, 200, 200, 2, 2, 2], name: '立方体' },
	{ type: 'CircleGeometry', args: [500,32], name: '圆形（2d似乎不可见）' },
	{ type: 'ExtrudeGeometry', args: [shape, extrudeSettings], name: '挤压缓冲几何体' },
	{ type: 'ShapeGeometry', args: [heartShape], name: '形状缓冲几何体（2d似乎不可见）' },
	{ type: 'TubeGeometry', args: [path, 20, 2, 8, false ], meshScale: 15, name: '管道缓冲几何体' },
	{ type: 'PolyhedronGeometry', args: [verticesOfCube, indicesOfFaces, 6, 2  ], meshScale: 15, name: '多面缓冲几何体' },
	{ type: 'TorusGeometry', args: [100, 60, 4, 8, Math.PI * 2], name: '甜甜圈' },
	{ type: 'TorusKnotGeometry', args: [], scale: 0.25, meshScale: 3, name: '环结' },
	{ type: 'SphereGeometry', args: [100, 32, 16], meshScale: 1.5, name: '球' },
	{ type: 'IcosahedronGeometry', args: [100, 1], meshScale: 1.5, name: '二十面体' },
	{ type: 'CylinderGeometry', args: [25, 75, 200, 8, 3], meshScale: 1.5, name: '圆台' },
	{ type: 'OctahedronGeometry', args: [200, 0], name: '八面体' },
	{type: 'LatheGeometry', args: [[
			new THREE.Vector2(0, 0),
			new THREE.Vector2(50, 50),
			new THREE.Vector2(10, 100),
			new THREE.Vector2(50, 150),
			new THREE.Vector2(0, 200)]], meshScale: 2, name: '车削缓冲几何体'
	},

];
//有bug待调试
function myfileinput() {
	const fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = '.obj';
	fileInput.style.position = 'absolute';
	fileInput.style.top = '100px';
	fileInput.style.left = '10px';
	document.body.appendChild(fileInput);

	// 处理文件选择事件
	fileInput.addEventListener('change', function (event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function (e) {
				const contents = e.target.result;
				const loader = new THREE.OBJLoader();
				const object = loader.parse(contents);
				console.log(object);
				console.log("good");
				const geometry = object.children[0].geometry;
				models.push({
					type: "mytype",
					args: [],
					scale: 1,
					meshScale: 1.5
				});
				THREE["mytype"] = function () {
					return geometry.clone();
				};
				updateModel();
				// 更新用户选项
				updateOptions();


			};
			reader.readAsText(file);
		}
	});
}


let createModel = function (klass, args) {
	let F = function (klass, args) {
		return klass.apply(this, args);
	};
	F.prototype = klass.prototype;
	return new F(klass, args);
};

init();
animate();
function init() {
	options = document.createElement('div');
	options.style.position = 'absolute';
	options.style.top = '10px';
	options.style.left = '50px';
	options.style.width = '100%';
	options.style.textAlign = 'left';
	document.body.appendChild(options);
	container = document.createElement('div');
	document.body.appendChild(container);
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xff0000);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 5000);
	camera.position.set(0, 0, 700);

	let light = new THREE.AmbientLight(0x404040, 3);
	scene.add(light);

	//渲染器
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setClearColor(0xf0f0f0);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	container.appendChild(renderer.domElement);
	renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
	renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);

	//相机轨道控制器 
	controls = new THREE.OrbitControls(camera, renderer.domElement);
	controls.addEventListener('change', render);

	//物体变换控制器，在3D空间中变换物体
	trfm_ctrl = new THREE.TransformControls(camera, renderer.domElement);
	scene.add(trfm_ctrl);
	trfm_ctrl.addEventListener('change', render);
	trfm_ctrl.addEventListener('objectChange', function (e) {
		ffd.updateLines(latticeLines);
		deform();
	});
	window.addEventListener('resize', onWindowResize, false);
	updateModel();
}
//随窗口大小而改变。
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}
function onDocumentMouseMove(event) {
	event.preventDefault();
	//相对定位
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);
	//射线检验
	let intersects = raycaster.intersectObjects(ctrl_pt_meshes);
	//放在控制点上要检测
	if (intersects.length > 0 && ctrl_pt_mesh_selected != intersects[0].object) {
		container.style.cursor = 'pointer';
	}
	else {
		container.style.cursor = 'auto';
	}
}
//控制按下时的位置
function onDocumentMouseDown(event) {
	event.preventDefault();
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);
	//放在控制点上要检测
	let intersects = raycaster.intersectObjects(ctrl_pt_meshes);
	if (intersects.length > 0 && ctrl_pt_mesh_selected != intersects[0].object) {
		//先禁止摄像头移动，防止移动点的同时摄像头移动
		controls.enabled = false;
		if (ctrl_pt_mesh_selected)
			trfm_ctrl.detach(trfm_ctrl.object);
		ctrl_pt_mesh_selected = intersects[0].object;
		trfm_ctrl.attach(ctrl_pt_mesh_selected);
	}
	else {
		//摄像头可以移动
		controls.enabled = true;
	}
}

//基础的渲染场景循环
function animate() {
	requestAnimationFrame(animate);
	controls.update();
	trfm_ctrl.update();
	render()
}
//渲染
function render() {
	renderer.render(scene, camera);
}
//更新选项。
function updateOptions() {
	// 创建下拉选择框

	let dropdown = `<label for="model">模型:</label>` + '<select id="model" onchange="switchModel( this.value )">';

	for (i = 0; i < models.length; i++) {
		dropdown += '<option value="' + i + '"';
		dropdown += (model_index == i) ? ' selected' : '';
		dropdown += '>' + models[i].name + '</option>';
	}
	dropdown += '</select>';
	// 创建细分级别控制
	const subdivisionControls = createSubdivisionControls('Subdivision level', 'subd_level', 'nextSubdivisionLevel');

	// 创建顶点和面计数显示
	const geometryInfo = createGeometryInfo(ori_geom, smooth_geom);

	// 创建跨度计数控制
	const spanControls = createSpanControls('Span count', span_counts, 'nextSpanCount');
	const musicSelectControl = `
        <div>
            <label for="musicFile">选择音乐:</label>
            <input type="file" id="musicFile" accept="audio/*" style="display:none;"/>
            <button id="selectMusicButton" onclick="document.getElementById('musicFile').click();">选择音乐</button>
    `;
	const musicControls = `
		<label>Music:</label>
		<button id="musicButton" onclick="toggleMusic();">Play/Pause</button>
	</div>

`;
	const volumeControls = createVolumeControls();
	// 将所有元素拼接到options.innerHTML
	options.innerHTML = `
        ${dropdown}
        ${subdivisionControls}
        ${geometryInfo}
        ${spanControls}	
		${musicSelectControl}
		${musicControls}
		${volumeControls}
    `;
	document.getElementById('musicFile').addEventListener('change', handleMusicFileSelect);

}
//以下为选项对应的函数
//改变模型选择的函数
function switchModel(index) {
	model_index = index;
	updateModel();
}
//处理音乐文件选择的函数
function handleMusicFileSelect(event) {
	const audioPlayer = document.getElementById('audioPlayer');
	const file = event.target.files[0];
	if (file) {
		// 更新音频元素的源
		audioPlayer.src = URL.createObjectURL(file);
	}
}
//创建音量控制的通用函数
function createVolumeControls() {
	return `
            <label for="volumeControl">音量:</label>
            <input type="range" id="volumeControl" min="0" max="1" step="0.01" value="1" oninput="setVolume(this.value);"/>
        </div>
    `;
}
//改变细分程度的函数
function nextSubdivisionLevel(step) {
	let old_level = subLevel;
	subLevel = Math.max(0, Math.min(subLevel + step, 5));
	if (subLevel != old_level)
		updateModel();
}
// 播放/暂停音乐的函数
function toggleMusic() {
	var audioPlayer = document.getElementById('audioPlayer');
	if (audioPlayer.paused) {
		audioPlayer.play();
	} else {
		audioPlayer.pause();
	}
}
function setVolume(volumeValue) {
	var audioPlayer = document.getElementById('audioPlayer');
	audioPlayer.volume = volumeValue;
}
// 创建细分级别控制的通用函数
function createSubdivisionControls(label, levelKey, changeLevelFunc) {
	return `
		<div>
        <label>${label}:</label>
        <button onclick="${changeLevelFunc}(-1);">-</button> 
        <button onclick="${changeLevelFunc}(1);">+</button>

    `;
}
// 创建几何信息显示的通用函数
function createGeometryInfo(origGeom, smoothGeom) {
	return `
        <label>Vertices: ${origGeom.vertices.length} -> ${smoothGeom.vertices.length}</label>
        <label>Faces: ${origGeom.faces.length} -> ${smoothGeom.faces.length}</label>
		</div>

    `;
}
// 创建跨度计数控制的通用函数
function createSpanControls(label, counts, changeCountFunc) {
	return `
        <label>${label}:</label>
        ${['X', 'Y', 'Z'].map((axis, index) => `
            <button onclick="${changeCountFunc}(${index}, -1);">-</button> ${counts[index]} 
            <button onclick="${changeCountFunc}(${index}, 1);">+</button>
        `).join(' ')}
    `;
}

function updateModel() {
	if (smooth_mesh) {
		scene.remove(group);
		scene.remove(smooth_mesh);
	}

	let subd_modifier = new THREE.SubdivisionModifier(subLevel);
	let model = models[model_index];
	ori_geom = createModel(THREE[model.type], model.args);
	if (model.scale)
		ori_geom.scale(model.scale, model.scale, model.scale);
	smooth_geom = ori_geom.clone();

	if (smooth_geom.type != 'BufferGeometry') {
		smooth_geom.mergeVertices();
		smooth_geom.computeFaceNormals();
		smooth_geom.computeVertexNormals();

		subd_modifier.modify(smooth_geom);

		updateOptions();

		let color, f, p, n, vertexIndex;

		for (i = 0; i < smooth_geom.faces.length; i++) {
			f = smooth_geom.faces[i];
			n = (f instanceof THREE.Face3) ? 3 : 4;

			for (let j = 0; j < n; j++) {
				let faceABCD = "abcd";
				vertexIndex = f[faceABCD.charAt(j)];

				p = smooth_geom.vertices[vertexIndex];

				color = new THREE.Color(0xffffff);
				color.setHSL((p.y) / 200 + 0.5, 1.0, 0.5);

				f.vertexColors[j] = color;
			}
		}
	}
	group = new THREE.Group();
	scene.add(group);


	let smooth_materials = [
		new THREE.MeshBasicMaterial({ color: 0, wireframe: true, opacity: 0.8, transparent: true })
	
	];
	smooth_mesh = THREE.SceneUtils.createMultiMaterialObject(smooth_geom, smooth_materials);

	model_scale = model.meshScale ? model.meshScale : 1;
	smooth_mesh.scale.x = model_scale;
	smooth_mesh.scale.y = model_scale;
	smooth_mesh.scale.z = model_scale;

	scene.add(smooth_mesh);

	group.scale.copy(smooth_mesh.scale);

	smooth_verts_undeformed.length = 0;
	for (i = 0; i < smooth_geom.vertices.length; i++) {
		let copy_pt = new THREE.Vector3();
		copy_pt.copy(smooth_geom.vertices[i]);
		smooth_verts_undeformed.push(copy_pt);
	}

	rebuildFFD(false);
}

function nextSpanCount(direction, step) {
	let old_count = span_counts[direction];

	span_counts[direction] = Math.max(1, Math.min(span_counts[direction] + step, 10));

	if (span_counts[direction] != old_count) {
		rebuildFFD(true);
		updateOptions();
	}
}

//移除后重新计算FFD的相应点与线再添加，再渲染。
function rebuildFFD(span_count_change_only) {
	removeCtrlPtMeshes();
	removeLatticeLines();

	let bbox;
	if (span_count_change_only) {
		bbox = BBox
	}
	else {
		bbox = new THREE.Box3();
		bbox.setFromPoints(smooth_geom.vertices);
		if (model_scale != 1)
			bbox.set(bbox.min.multiplyScalar(model_scale), bbox.max.multiplyScalar(model_scale))
	}

	let span_counts_copy = [span_counts[0], span_counts[1], span_counts[2]];

	ffd.rebuildLattice(bbox, span_counts_copy);

	addCtrlPtMeshes();
	addLines();

	deform();
}

//对控制点mesh的移除
function removeCtrlPtMeshes() {
	for (let i = 0; i < ctrl_pt_meshes.length; i++)
		scene.remove(ctrl_pt_meshes[i]);
	ctrl_pt_meshes.length = 0;
}
//对辅助线的移除
function removeLatticeLines() {
	for (let i = 0; i < latticeLines.length; i++)
		scene.remove(latticeLines[i]);
	latticeLines.length = 0;
}

//对控制点mesh的添加
function addCtrlPtMeshes() {
	for (let i = 0; i < totalCtrlPtCount; i++) {
		let ctrl_pt_mesh = new THREE.Mesh(ctrlPointGeometry, ctrlPointMaterial);
		ctrl_pt_mesh.position.copy(controlPoints[i]);
		ctrl_pt_meshes.push(ctrl_pt_mesh);
		scene.add(ctrl_pt_mesh);
	}
}
//对辅助线的添加
function addLines() {
	for (let i = 0; i < ctrlPtCounts[0] - 1; i++) {
		for (let j = 0; j < ctrlPtCounts[1]; j++) {
			for (let k = 0; k < ctrlPtCounts[2]; k++) {
				let geometry = new THREE.Geometry();
				geometry.vertices.push(ctrl_pt_meshes[getControlPointIndex(i, j, k)].position);
				geometry.vertices.push(ctrl_pt_meshes[getControlPointIndex(i + 1, j, k)].position);
				let line = new THREE.Line(geometry, latticeLinesMaterial);
				latticeLines.push(line);
				scene.add(line);
			}
		}
	}
	for (let i = 0; i < ctrlPtCounts[0]; i++) {
		for (let j = 0; j < ctrlPtCounts[1] - 1; j++) {
			for (let k = 0; k < ctrlPtCounts[2]; k++) {
				let geometry = new THREE.Geometry();
				geometry.vertices.push(ctrl_pt_meshes[getControlPointIndex(i, j, k)].position);
				geometry.vertices.push(ctrl_pt_meshes[getControlPointIndex(i, j + 1, k)].position);
				let line = new THREE.Line(geometry, latticeLinesMaterial);
				latticeLines.push(line);
				scene.add(line);
			}
		}
	}
	for (let i = 0; i < ctrlPtCounts[0]; i++) {
		for (let j = 0; j < ctrlPtCounts[1]; j++) {
			for (let k = 0; k < ctrlPtCounts[2] - 1; k++) {
				let geometry = new THREE.Geometry();
				geometry.vertices.push(ctrl_pt_meshes[getControlPointIndex(i, j, k)].position);
				geometry.vertices.push(ctrl_pt_meshes[getControlPointIndex(i, j, k + 1)].position);
				let line = new THREE.Line(geometry, latticeLinesMaterial);
				latticeLines.push(line);
				scene.add(line);
			}
		}
	}
}

//处理变形的函数
function deform() {
	for (i = 0; i < smooth_geom.vertices.length; i++) {
		let eval_pt = ffd.eval(smooth_verts_undeformed[i]);
		if (eval_pt.equals(smooth_geom.vertices[i]))
			continue;
		smooth_geom.vertices[i].copy(eval_pt);
	}
	smooth_geom.verticesNeedUpdate = true;
}

