import { MaterialLoader } from './../../../build/three.module.js';
import {
	NodeMaterial,
	LineBasicNodeMaterial,
	MeshBasicNodeMaterial,
	MeshStandardNodeMaterial,
	MeshPhysicalNodeMaterial,
	PointsNodeMaterial,
	SpriteNodeMaterial
} from '../materials/Materials.js';

const superFromTypeFunction = MaterialLoader.createMaterialFromType;

MaterialLoader.createMaterialFromType = function ( type ) {

	const materialLib = {
		NodeMaterial,
		LineBasicNodeMaterial,
		MeshBasicNodeMaterial,
		MeshStandardNodeMaterial,
		MeshPhysicalNodeMaterial,
		PointsNodeMaterial,
		SpriteNodeMaterial
	};

	if ( materialLib[ type ] !== undefined ) {

		return new materialLib[ type ]();

	}

	return superFromTypeFunction.call( this, type );

};

class NodeMaterialLoader extends MaterialLoader {

	constructor( manager ) {

		super( manager );

		this.nodes = {};

	}

	parse( json ) {

		const material = super.parse( json );

		const nodes = this.nodes;
		const inputNodes = json.inputNodes;

		for ( const property in inputNodes ) {

			const uuid = inputNodes[ property ];

			material[ property ] = nodes[ uuid ];

		}

		return material;

	}

	setNodes( value ) {

		this.nodes = value;

		return this;

	}

}

export default NodeMaterialLoader;
