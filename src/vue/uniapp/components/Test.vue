<template>
	<view>
		test - {{num}} - props.a[{{a}}]
		<view>
			modelA - {{modelA}}
			<view>
				<button @tap="modelA++">点击</button>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		effect,
		effectScope,
		getContext,
		getCurrentInstance,
		h,
		inject,
		onMounted,
		onUpdated,
		reactive,
		useModel
	} from 'vue2use';

	export default {
		name: "Test",
		inject: [],
		props: {
			a: {}
		},
		emit: ["update:a"],
		setup(props, context) {
			const obj = reactive({
				a: 1
			})
			const modelA = useModel(props, "a", {
				default: 1
			})
			console.log(getContext(), props)
			console.log(getCurrentInstance().proxy)
			console.log(h("view"))
			onMounted(() => {
				console.log("onMounted")
			})
			onUpdated(() => {
				console.log("onUpdated")
			})
			context.expose({
				obj
			})

			effect(() => {
				console.log(obj.a);
				console.log(props.a)
			})

			effectScope().run(() => {
				effect(() => {
					console.log(obj.a);
					console.log(props.a)
				})
			})
			obj.a = 1;

			return {
				num: inject("num"),
				obj,
				modelA
			}
		}
	}
</script>

<style>

</style>