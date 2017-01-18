import Node from '../Node.js';
import isProgramLevel from '../utils/isProgramLevel.js';
import callHasEffects from './shared/callHasEffects.js';

export default class CallExpression extends Node {
	bind ( scope ) {
		if ( this.callee.type === 'Identifier' ) {
			const declaration = scope.findDeclaration( this.callee.name );

			if ( declaration.isNamespace ) {
				this.module.error({
					code: 'CANNOT_CALL_NAMESPACE',
					message: `Cannot call a namespace ('${this.callee.name}')`
				}, this.start );
			}

			if ( this.callee.name === 'eval' && declaration.isGlobal ) {
				this.module.warn({
					code: 'EVAL',
					message: `Use of eval is strongly discouraged, as it poses security risks and may cause issues with minification`,
					url: 'https://github.com/rollup/rollup/wiki/Troubleshooting#avoiding-eval'
				}, this.start );
			}
		}

		super.bind( scope );
	}

	hasEffects ( scope ) {
		// the only cases we care about are static augmentations of classes
		// ```
		//   Object.defineProperty(A.prototype, ...)
		//   Object.assign(A.prototype, Mixin)
		// ```
		// static variables or functions
		// ```
		// A.type = 'figure'
		// ```
		// and static function calls with only plain arguments or arguments declared within the module
		// (Note: maybe it would be better to get to the declaration and leave information there)
		// ```
		// class A extends B {}
		// A.define({ ... })
		// ```
		if (scope.isModuleScope) {
			// detect Object.defineProperty(), Object.defineProperties(), and Object.assign()
			if (this.callee.type === 'MemberExpression') {
				if (this.callee.object.name === 'Object') {
					const propName = this.callee.property.name;
					if (propName === 'defineProperty' || propName === 'defineProperties' || propName === 'assign') {
						const proto = this.arguments[0];
						if (proto.type === 'MemberExpression' && proto.property.name === 'prototype') {
							return proto.object.declaration.activated;
						}
						if (proto.type === 'Identifier') {
							return proto.declaration.activated;
						}
					}
				}
			}
		}
		return callHasEffects( scope, this.callee, false );
	}

	initialise ( scope ) {
		if ( isProgramLevel( this ) ) {
			this.module.bundle.dependentExpressions.push( this );
		}
		super.initialise( scope );
	}

	isUsedByBundle () {
		return this.hasEffects( this.findScope() );
	}
}
