<template>
	<view class="content">
		<image class="logo" src="/static/logo.png"></image>
		<view class="text-area">
			<text class="title">{{title}}</text>
		</view>
		<view>
			<h1>{{num}}</h1>
			<button @tap="num++">点击</button>
		</view>
		<Test :num="num+1" ref="testRef" :a="num * 2" @update:a="num=$event">
			<template #default="{row}">
				<view>{{row.a}}</view>
			</template>
		</Test>
	</view>
</template>

<script>
	import {
		defineComponent,
		getContext,
		getCurrentInstance,
		provide,
		ref
	} from "vue2use";
	import Test from "@/components/Test.vue"

	export default {
		provide: {
			a: "aaa"
		},
		setup(props, context) {
			defineComponent({
				components: {
					Test: Test
				}
			})
			const num = ref(1);
			const testRef = ref()
			provide("num", num)
			console.log(getCurrentInstance().proxy)
			console.log("testRef", testRef)
			return {
				num,
				testRef
			}
		},
		data() {
			return {
				title: 'Hello'
			}
		},
		onLoad() {

		},
		methods: {

		}
	}
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.logo {
		height: 200rpx;
		width: 200rpx;
		margin-top: 200rpx;
		margin-left: auto;
		margin-right: auto;
		margin-bottom: 50rpx;
	}

	.text-area {
		display: flex;
		justify-content: center;
	}

	.title {
		font-size: 36rpx;
		color: #8f8f94;
	}
</style>